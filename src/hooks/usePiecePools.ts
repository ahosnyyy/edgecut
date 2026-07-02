import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";
import { type TemplateDetail } from "./useTemplates";
import { useProfileSystems, type SystemConstant } from "./useProfileSystems";
import { generatePieces, type TemplateVariable } from "../engine/pieceGenerator";

export interface SizeGroup {
  avgW: string;
  avgH: string;
  locations: string[];
  count: number;
}

export interface PieceGroup {
  profileType: string;
  label: string;
  count: number;
  indices: number[];
}

export interface PiecePoolGroupData {
  group: {
    pieceTemplateId: string;
    pieceTemplateName: string;
    openings: { id: string; label: string }[];
  };
  sizeGroups: SizeGroup[];
  piecesBySize: { pieces: { label: string; profileType: string; length: number; quantity: number }[]; errors: string[] }[];
  pieceGroups: PieceGroup[];
}

export interface PiecePoolsInput {
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  floors: number;
  apartmentsPerFloor: number;
  floorLabels: string[];
  convertFromMM: (mm: number) => number;
  convertToMM: (val: number) => number;
}

export interface PiecePoolTemplateInfo {
  pieceTemplateId: string;
  pieceTemplateName: string;
}


/**
 * Fetches apartment template openings for all used template IDs.
 */
function useTemplateOpenings(usedTemplateIds: string[]) {
  const templateQueries = useQueries({
    queries: usedTemplateIds.map((tplId) => ({
      queryKey: ["apartment-template", tplId],
      queryFn: () =>
        apiFetch<{
          openings: { id: string; label: string; pieceTemplateId: string; templateName: string }[];
        }>(`/api/apartment-templates/${tplId}`),
      enabled: !!tplId,
    })),
  });

  return useMemo(() => {
    const m: Record<string, { id: string; label: string; pieceTemplateId: string; templateName: string }[]> = {};
    usedTemplateIds.forEach((tplId, i) => {
      const q = templateQueries[i];
      if (q?.data?.openings) {
        m[tplId] = q.data.openings.map((o) => ({
          id: o.id,
          label: o.label,
          pieceTemplateId: o.pieceTemplateId,
          templateName: o.templateName,
        }));
      }
    });
    return m;
  }, [templateQueries, usedTemplateIds]);
}

/**
 * Fetches piece template details for all given template IDs.
 */
function useAllTemplateDetails(templateIds: string[]) {
  const queries = useQueries({
    queries: templateIds.map((id) => ({
      queryKey: ["template", id],
      queryFn: () => apiFetch<TemplateDetail>(`/api/templates/${id}`),
      enabled: !!id,
    })),
  });

  return useMemo(() => {
    const m: Record<string, TemplateDetail> = {};
    templateIds.forEach((id, i) => {
      const q = queries[i];
      if (q?.data) m[id] = q.data;
    });
    return m;
  }, [queries, templateIds]);
}

/**
 * Computes all piece pool data for a building — all groups, all size groups, all pieces.
 * This is the shared computation used by both the PiecePools tab and the PDF export.
 */
export function usePiecePools(input: PiecePoolsInput): {
  allGroups: PiecePoolTemplateInfo[];
  groupData: PiecePoolGroupData[];
  isLoading: boolean;
} {
  const { existingAssignments, existingSizes, floors, apartmentsPerFloor, floorLabels, convertFromMM, convertToMM } = input;

  // Build sizes map
  const sizes = useMemo(() => {
    const g: Record<string, { width: string; height: string }> = {};
    for (const s of existingSizes) {
      g[`${s.apartmentTemplateOpeningId}_${s.floor}_${s.apartmentIndex}`] = {
        width: String(convertFromMM(s.width)),
        height: String(convertFromMM(s.height)),
      };
    }
    return g;
  }, [existingSizes, convertFromMM]);

  // Assignment map
  const assignmentMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const a of existingAssignments) {
      m[`${a.floor}_${a.apartmentIndex}`] = a.apartmentTemplateId;
    }
    return m;
  }, [existingAssignments]);

  // Collect all unique apartment template IDs
  const usedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of existingAssignments) {
      if (a.apartmentTemplateId) ids.add(a.apartmentTemplateId);
    }
    return Array.from(ids);
  }, [existingAssignments]);

  // Fetch openings for all used templates
  const templateOpeningsMap = useTemplateOpenings(usedTemplateIds);

  // Group openings by pieceTemplateId
  const allGroups = useMemo(() => {
    const groupMap = new Map<string, { pieceTemplateId: string; pieceTemplateName: string; openings: { id: string; label: string }[] }>();
    for (const [, openings] of Object.entries(templateOpeningsMap)) {
      for (const o of openings) {
        if (!groupMap.has(o.pieceTemplateId)) {
          groupMap.set(o.pieceTemplateId, { pieceTemplateId: o.pieceTemplateId, pieceTemplateName: o.templateName, openings: [] });
        }
        groupMap.get(o.pieceTemplateId)!.openings.push({ id: o.id, label: o.label });
      }
    }
    return Array.from(groupMap.values());
  }, [templateOpeningsMap]);

  // Fetch all template details at once
  const allPieceTemplateIds = useMemo(() => allGroups.map((g) => g.pieceTemplateId), [allGroups]);
  const allTemplateDetails = useAllTemplateDetails(allPieceTemplateIds);
  const { data: profileSystemsList } = useProfileSystems();

  // Pre-compute system constants for each unique profileSystemId
  const systemConstantsMap = useMemo(() => {
    const m: Record<string, SystemConstant[]> = {};
    if (!profileSystemsList) return m;
    for (const detail of Object.values(allTemplateDetails)) {
      if (!detail.profileSystemId || m[detail.profileSystemId]) continue;
      const sys = profileSystemsList.find((s) => s.id === detail.profileSystemId);
      if (!sys?.constants) continue;
      try {
        m[detail.profileSystemId] = JSON.parse(sys.constants) as SystemConstant[];
      } catch {
        m[detail.profileSystemId] = [];
      }
    }
    return m;
  }, [allTemplateDetails, profileSystemsList]);

  // Compute size groups and pieces for each group
  const groupData = useMemo(() => {
    return allGroups.map((group) => {
      const templateDetail = allTemplateDetails[group.pieceTemplateId];
      const openingIds = new Set(group.openings.map((o) => o.id));

      // Collect all cells for this group
      const cells: { floor: number; aptIndex: number; w: number; h: number; openingId: string }[] = [];
      for (let f = 0; f < floors; f++) {
        for (let i = 0; i < apartmentsPerFloor; i++) {
          const aptTplId = assignmentMap[`${f}_${i}`];
          if (!aptTplId) continue;
          const openings = templateOpeningsMap[aptTplId] ?? [];
          for (const o of openings) {
            if (!openingIds.has(o.id)) continue;
            const key = `${o.id}_${f}_${i}`;
            const cell = sizes[key];
            if (!cell || !cell.width || !cell.height) continue;
            const w = parseFloat(cell.width);
            const h = parseFloat(cell.height);
            if (isNaN(w) || isNaN(h)) continue;
            cells.push({ floor: f, aptIndex: i, w, h, openingId: o.id });
          }
        }
      }

      // Group cells by exact W×H
      const sizeKeyMap = new Map<string, { w: number; h: number; locations: Map<string, number>; count: number }>();
      for (const cell of cells) {
        const sizeKey = `${cell.w}_${cell.h}`;
        if (!sizeKeyMap.has(sizeKey)) {
          sizeKeyMap.set(sizeKey, { w: cell.w, h: cell.h, locations: new Map(), count: 0 });
        }
        const entry = sizeKeyMap.get(sizeKey)!;
        const loc = `${floorLabels[cell.floor] ?? String.fromCharCode(65 + cell.floor)}${cell.aptIndex + 1}`;
        entry.locations.set(loc, (entry.locations.get(loc) ?? 0) + 1);
        entry.count++;
      }

      const sizeGroups: SizeGroup[] = Array.from(sizeKeyMap.values()).map((g) => ({
        avgW: String(g.w),
        avgH: String(g.h),
        locations: Array.from(g.locations.entries()).map(([loc, n]) => `${n}×${loc}`),
        count: g.count,
      }));

      // Compute pieces for each size group
      let piecesBySize: PiecePoolGroupData["piecesBySize"] = [];
      let pieceGroups: PieceGroup[] = [];

      if (templateDetail?.pieces) {
        const systemConstants = systemConstantsMap[templateDetail.profileSystemId ?? ""] ?? [];
        const variables: TemplateVariable[] = [
          ...systemConstants.map((c) => ({ name: c.name, defaultValue: c.defaultValue })),
          ...(templateDetail.variables ?? []).map((v) => ({
            name: v.name,
            defaultValue: v.defaultValue,
          })),
        ];

        piecesBySize = sizeGroups.map((sg) => {
          const wMm = convertToMM(parseFloat(sg.avgW));
          const hMm = convertToMM(parseFloat(sg.avgH));
          const result = generatePieces(
            templateDetail.pieces.map((p) => ({
              id: p.id,
              label: p.label,
              profileType: p.profileType,
              lengthFormula: p.lengthFormula,
              quantity: p.quantity,
            })),
            variables,
            wMm,
            hMm,
          );
          return { pieces: result.pieces, errors: result.errors };
        });

        // Build piece groups from first size group
        const firstPieces = piecesBySize[0]?.pieces ?? [];
        const groups: PieceGroup[] = [];
        const seen = new Map<string, number>();
        for (let i = 0; i < firstPieces.length; i++) {
          const pt = firstPieces[i].profileType;
          if (seen.has(pt)) {
            const gi = seen.get(pt)!;
            groups[gi].count++;
            groups[gi].indices.push(i);
          } else {
            seen.set(pt, groups.length);
            groups.push({ profileType: pt, label: pt.charAt(0).toUpperCase() + pt.slice(1), count: 1, indices: [i] });
          }
        }
        pieceGroups = groups;
      }

      return { group, sizeGroups, piecesBySize, pieceGroups };
    });
  }, [allGroups, allTemplateDetails, systemConstantsMap, sizes, floors, apartmentsPerFloor, assignmentMap, templateOpeningsMap, floorLabels, convertToMM]);

  const isLoading = usedTemplateIds.length > 0 && Object.keys(templateOpeningsMap).length < usedTemplateIds.length;

  return { allGroups, groupData, isLoading };
}
