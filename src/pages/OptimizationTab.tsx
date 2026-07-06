import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";
import { useApp, ACTIONS } from "../context/AppContext";
import { useSettings } from "../hooks/useSettings";
import { useProjectStock } from "../hooks/useProjects";
import { useTemplate } from "../hooks/useTemplates";
import { useProfileSystems, type SystemConstant } from "../hooks/useProfileSystems";
import { useProfileTypes } from "../hooks/useProfileTypes";
import {
  useCuttingPlans,
  useSaveCuttingPlan,
  useUpdateCuttingPlan,
  useApplyCuttingPlan,
  useUnapplyCuttingPlan,
  useDeleteCuttingPlan,
} from "../hooks/useCuttingPlans";
import { generatePieces, type TemplateVariable } from "../engine/pieceGenerator";
import { optimize } from "../engine/optimizer";
import ResultsPanel from "../components/Results/ResultsPanel";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { LoadingState } from "../components/ui/loading-states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SparklesIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  AlertCircleIcon,
  ScissorIcon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  FileDownloadIcon,
} from "@hugeicons/core-free-icons";
import type { BuildingLike } from "./ProjectBuilder";
import { usePiecePools } from "../hooks/usePiecePools";
import ExportAllDialog from "../components/ExportAllDialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { useIsMobile } from "../hooks/use-mobile";

interface SizeGrid {
  [key: string]: { width: string; height: string };
}

function useProfileTypeLabel() {
  const { data: profileTypes } = useProfileTypes();
  return (key: string) =>
    profileTypes?.find((pt) => pt.key === key)?.label ??
    key.charAt(0).toUpperCase() + key.slice(1);
}

export function OptimizationTab({
  projectId,
  projectName,
  building,
  existingAssignments,
  existingSizes,
  aptTemplateNames,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  projectId: string;
  projectName: string;
  building: BuildingLike;
  existingAssignments: { floor: number; apartmentIndex: number; apartmentTemplateId: string | null }[];
  existingSizes: { apartmentTemplateOpeningId: string; floor: number; apartmentIndex: number; width: number; height: number }[];
  aptTemplateNames: Record<string, string>;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const { fromMM: convertFromMM, toMM: convertToMM, formatLength, kerfWidth, optimizationStrategy, displayUnit, unitLabel } = useSettings();
  const profileTypeLabel = useProfileTypeLabel();
  const { dispatch, state, getRGBForLength } = useApp();
  const { data: stockEntries } = useProjectStock(projectId);
  const isMobile = useIsMobile();

  const [showExportDialog, setShowExportDialog] = useState(false);

  // Build stock lookup from all project stock entries (covers all profile types)
  const stockLookup = useMemo(() => {
    const map = new Map<string, { label: string; length: number }>();
    for (const s of stockEntries ?? []) {
      map.set(s.id, { label: s.label ?? s.id, length: s.length ?? 0 });
    }
    return map;
  }, [stockEntries]);

  const floors = building.floors;
  const apartmentsPerFloor = building.apartmentsPerFloor;
  let floorLabels: string[] = [];
  try { floorLabels = JSON.parse(building.floorLabels); } catch { floorLabels = []; }

  // Compute piece pool data for export
  const { groupData: piecePoolGroups } = usePiecePools({
    existingAssignments,
    existingSizes,
    floors: building.floors,
    apartmentsPerFloor: building.apartmentsPerFloor,
    floorLabels,
    convertFromMM,
    convertToMM,
  });

  // Build sizes map
  const sizes = useMemo(() => {
    const g: SizeGrid = {};
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

  // Collect unique apartment template IDs
  const usedTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of existingAssignments) {
      if (a.apartmentTemplateId) ids.add(a.apartmentTemplateId);
    }
    return Array.from(ids);
  }, [existingAssignments]);

  // Fetch apartment templates to get openings
  const templateQueries = useQueries({
    queries: usedTemplateIds.map((tplId) => ({
      queryKey: ["apartment-template", tplId],
      queryFn: () => apiFetch<{ openings: { id: string; label: string; pieceTemplateId: string; templateName: string }[] }>(`/api/apartment-templates/${tplId}`),
      enabled: !!tplId,
    })),
  });

  const templateOpeningsMap = useMemo(() => {
    const m: Record<string, { id: string; label: string; pieceTemplateId: string; templateName: string }[]> = {};
    usedTemplateIds.forEach((tplId, i) => {
      const q = templateQueries[i];
      if (q?.data?.openings) {
        m[tplId] = q.data.openings.map((o) => ({ id: o.id, label: o.label, pieceTemplateId: o.pieceTemplateId, templateName: o.templateName }));
      }
    });
    return m;
  }, [templateQueries, usedTemplateIds]);

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

  // For each group, collect cells and group by W×H
  const groupSizeData = useMemo(() => {
    return allGroups.map((group) => {
      const openingIds = new Set(group.openings.map((o) => o.id));
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

      const sizeKeyMap = new Map<string, { w: number; h: number; count: number }>();
      for (const cell of cells) {
        const sizeKey = `${cell.w}_${cell.h}`;
        if (!sizeKeyMap.has(sizeKey)) {
          sizeKeyMap.set(sizeKey, { w: cell.w, h: cell.h, count: 0 });
        }
        sizeKeyMap.get(sizeKey)!.count++;
      }

      const sizeGroups = Array.from(sizeKeyMap.values()).map((g) => ({
        avgW: String(g.w),
        avgH: String(g.h),
        count: g.count,
      }));

      return { group, sizeGroups };
    });
  }, [allGroups, sizes, floors, apartmentsPerFloor, assignmentMap, templateOpeningsMap]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeGroupId && allGroups.length > 0) {
      setActiveGroupId(allGroups[0].pieceTemplateId);
    }
  }, [allGroups, activeGroupId]);

  const activeData = groupSizeData.find((d) => d.group.pieceTemplateId === activeGroupId);

  // Fetch template detail for the active group
  const { data: templateDetail } = useTemplate(activeGroupId);
  const { data: profileSystemsList } = useProfileSystems();

  const systemConstants = useMemo((): SystemConstant[] => {
    if (!templateDetail?.profileSystemId || !profileSystemsList) return [];
    const sys = profileSystemsList.find((s) => s.id === templateDetail.profileSystemId);
    if (!sys?.constants) return [];
    try {
      return JSON.parse(sys.constants) as SystemConstant[];
    } catch {
      return [];
    }
  }, [templateDetail?.profileSystemId, profileSystemsList]);

  // Resolve profile system key for the active template
  const activeProfileSystemKey = useMemo(() => {
    if (!templateDetail?.profileSystemId || !profileSystemsList) return null;
    const sys = profileSystemsList.find((s) => s.id === templateDetail.profileSystemId);
    return sys?.key ?? null;
  }, [templateDetail?.profileSystemId, profileSystemsList]);

  // Evaluate pieces for each size group and aggregate by profile type
  const poolsByProfileType = useMemo(() => {
    if (!templateDetail?.pieces || !activeData) return null;

    const variables: TemplateVariable[] = [
      ...systemConstants.map((c) => ({ name: c.name, defaultValue: c.defaultValue })),
      ...(templateDetail.variables ?? []).map((v) => ({
        name: v.name,
        defaultValue: v.defaultValue,
      })),
    ];

    // Aggregate demand pieces by profile type across all size groups
    const byProfileType: Map<string, { label: string; length: number; quantity: number }[]> = new Map();

    for (const sg of activeData.sizeGroups) {
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

      for (const piece of result.pieces) {
        const list = byProfileType.get(piece.profileType) ?? [];
        // Multiply piece quantity by size group count
        list.push({
          label: piece.label,
          length: piece.length,
          quantity: piece.quantity * sg.count,
        });
        byProfileType.set(piece.profileType, list);
      }
    }

    // Merge pieces with same label+length within a profile type
    const merged: { profileType: string; pieces: { label: string; length: number; quantity: number }[] }[] = [];
    for (const [profileType, pieces] of byProfileType) {
      const mergedPieces: { label: string; length: number; quantity: number }[] = [];
      for (const p of pieces) {
        const existing = mergedPieces.find((mp) => mp.label === p.label && mp.length === p.length);
        if (existing) {
          existing.quantity += p.quantity;
        } else {
          mergedPieces.push({ ...p });
        }
      }
      merged.push({ profileType, pieces: mergedPieces });
    }

    return merged;
  }, [templateDetail, activeData, convertToMM, systemConstants]);

  // Match stock entries to each profile type pool
  const poolsWithStock = useMemo(() => {
    if (!poolsByProfileType || !stockEntries) return null;
    return poolsByProfileType.map((pool) => {
      const matchingStock = stockEntries.filter((s) => {
        if (s.profileType !== pool.profileType) return false;
        if (activeProfileSystemKey && s.profileSystem && s.profileSystem !== activeProfileSystemKey) return false;
        return true;
      });
      return { ...pool, stock: matchingStock };
    });
  }, [poolsByProfileType, stockEntries, activeProfileSystemKey]);

  const [activeProfileType, setActiveProfileType] = useState<string | null>(null);

  useEffect(() => {
    if (poolsWithStock && poolsWithStock.length > 0) {
      if (!activeProfileType || !poolsWithStock.find((p) => p.profileType === activeProfileType)) {
        setActiveProfileType(poolsWithStock[0].profileType);
      }
    }
  }, [poolsWithStock, activeProfileType]);

  const activePool = poolsWithStock?.find((p) => p.profileType === activeProfileType);

  // Pre-flight check: compare total demand vs total stock + estimate bars needed
  const stockCheck = useMemo(() => {
    if (!activePool) return null;
    const totalDemandLength = activePool.pieces.reduce((sum, p) => sum + p.length * p.quantity, 0);
    const totalStockLength = activePool.stock.reduce(
      (sum, s) => sum + (s.length ?? 0) * s.quantity,
      0
    );

    // Estimate bars needed per stock type (demand + kerf per cut / stock length)
    const totalCuts = activePool.pieces.reduce((sum, p) => sum + p.quantity, 0);
    const demandWithKerf = totalDemandLength + totalCuts * kerfWidth;
    const barsEstimate = activePool.stock
      .filter((s) => s.length && s.length > 0)
      .map((s) => {
        const barsNeeded = Math.ceil(demandWithKerf / s.length!);
        return {
          id: s.id,
          label: s.label ?? `${s.length}mm`,
          length: s.length!,
          isRemnant: s.isRemnant,
          available: s.quantity,
          needed: barsNeeded,
          shortfall: Math.max(0, barsNeeded - s.quantity),
        };
      });

    return {
      totalDemandLength: Math.round(totalDemandLength),
      totalStockLength: Math.round(totalStockLength),
      sufficient: totalStockLength >= totalDemandLength,
      barsEstimate,
    };
  }, [activePool, kerfWidth]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasOptimized, setHasOptimized] = useState(false);

  // ── Cutting plan persistence (save / apply / un-apply / delete) ──
  const { data: savedPlans, isLoading: isLoadingPlans } = useCuttingPlans(projectId, "building", building.id);
  const savePlanMutation = useSaveCuttingPlan();
  const updatePlanMutation = useUpdateCuttingPlan();
  const applyMutation = useApplyCuttingPlan();
  const unapplyMutation = useUnapplyCuttingPlan();
  const deletePlanMutation = useDeleteCuttingPlan();

  // The saved plan for the current (building, profileType) — may be applied or not
  const savedPlan = useMemo(() => {
    if (!savedPlans || !activeProfileType) return null;
    return savedPlans.find(
      (p) => p.scopeId === building.id && p.profileType === activeProfileType,
    ) ?? null;
  }, [savedPlans, activeProfileType, building.id]);

  // The applied plan for the current (building, profileType) — if any
  const appliedPlan = useMemo(() => {
    return savedPlan?.isApplied ? savedPlan : null;
  }, [savedPlan]);

  // Compute a signature of the current demand pieces for the active pool
  const currentDemandSignature = useMemo(() => {
    if (!activePool) return null;
    return activePool.pieces.map((p) => `${p.label}:${p.length}:${p.quantity}`).sort().join('|');
  }, [activePool]);

  // Compute signature from the saved plan's bars (what was actually optimized)
  const savedPlanDemandSignature = useMemo(() => {
    if (!savedPlan) return null;
    try {
      const bars = JSON.parse(savedPlan.bars) as { pieces: { label: string; length: number }[] }[];
      const pieceCounts = new Map<string, number>();
      for (const bar of bars) {
        for (const piece of bar.pieces ?? []) {
          const key = `${piece.label}:${piece.length}`;
          pieceCounts.set(key, (pieceCounts.get(key) ?? 0) + 1);
        }
      }
      return Array.from(pieceCounts.entries()).map(([k, v]) => `${k}:${v}`).sort().join('|');
    } catch {
      return null;
    }
  }, [savedPlan]);

  // Detect if demand pieces have changed since the plan was last optimized
  const demandChanged = savedPlanDemandSignature !== null && currentDemandSignature !== null && savedPlanDemandSignature !== currentDemandSignature;

  // Compute stock signature from the saved plan's bars (stockLengthId -> stockLength)
  const savedPlanStockSignature = useMemo(() => {
    if (!savedPlan) return null;
    try {
      const bars = JSON.parse(savedPlan.bars) as { stockLengthId: string; stockLength: number }[];
      const stockMap = new Map<string, number>();
      for (const bar of bars) {
        if (!stockMap.has(bar.stockLengthId)) {
          stockMap.set(bar.stockLengthId, bar.stockLength);
        }
      }
      return Array.from(stockMap.entries()).map(([id, len]) => `${id}:${len}`).sort().join('|');
    } catch {
      return null;
    }
  }, [savedPlan]);

  // Compute stock signature from current stock entries for the active profile type
  const currentStockSignature = useMemo(() => {
    if (!activePool) return null;
    return activePool.stock
      .map((s) => `${s.id}:${s.length ?? 0}`)
      .sort()
      .join('|');
  }, [activePool]);

  // Detect if stock entries were removed or their lengths changed since the plan was last optimized
  const stockChanged = savedPlanStockSignature !== null && currentStockSignature !== null && savedPlanStockSignature !== currentStockSignature;

  // Track which plan is currently loaded in the optimizer (from DB or new optimization)
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [showReapplyConfirm, setShowReapplyConfirm] = useState(false);

  // When switching profile types or groups, reset loaded plan tracking
  useEffect(() => {
    setLoadedPlanId(savedPlan?.id ?? null);
  }, [savedPlan?.id, activeProfileType, activeGroupId]);

  const handleOptimize = useCallback(() => {
    if (!activePool) return;

    // Map stock to optimizer format
    const stockLengths = activePool.stock.map((s) => ({
      id: s.id,
      length: s.length ?? 0,
      quantity: s.quantity,
      isRemnant: s.isRemnant,
      label: s.label ?? "",
    }));

    // Map demand pieces to optimizer format
    const demandPieces = activePool.pieces.map((p, i) => ({
      id: `piece-${i}`,
      label: p.label,
      length: p.length,
      quantity: p.quantity,
    }));

    setIsOptimizing(true);
    setHasOptimized(false);

    // Reset AppContext state for this pool
    dispatch({ type: ACTIONS.CLEAR_PLAN });

    // Load stock and demand into AppContext
    dispatch({ type: ACTIONS.SET_STOCK_LENGTHS, payload: stockLengths });
    dispatch({ type: ACTIONS.SET_DEMAND_PIECES, payload: demandPieces });
    dispatch({ type: ACTIONS.SET_KERF, payload: kerfWidth });
    dispatch({ type: ACTIONS.SET_OPTIMIZATION_STRATEGY, payload: optimizationStrategy });

    // Run optimization after state is set
    setTimeout(async () => {
      dispatch({ type: ACTIONS.RUN_OPTIMIZE });
      setIsOptimizing(false);
      setHasOptimized(true);

      // Compute the optimization result directly for auto-save
      // (state.cuttingPlan is stale in this closure)
      const result = optimize({
        stockLengths,
        demandPieces,
        kerfWidth,
        optimizationStrategy,
      });

      // Auto-save the plan to DB (create or update)
      if (result && activeProfileType && activePool) {
        const color = activePool.stock[0]?.color ?? "#000000";
        try {
          if (savedPlan && !savedPlan.isApplied) {
            await updatePlanMutation.mutateAsync({
              projectId,
              planId: savedPlan.id,
              data: {
                bars: result.bars,
                summary: result.summary,
                kerfWidth,
                strategy: optimizationStrategy,
              },
            });
            setLoadedPlanId(savedPlan.id);
          } else if (!savedPlan) {
            const saved = await savePlanMutation.mutateAsync({
              projectId,
              data: {
                scope: "building",
                scopeId: building.id,
                profileType: activeProfileType,
                color,
                bars: result.bars,
                summary: result.summary,
                kerfWidth,
                strategy: optimizationStrategy,
              },
            });
            setLoadedPlanId(saved.id);
          }
        } catch {
          // Save failed silently — plan still shows in UI
        }
      }
    }, 100);
  }, [activePool, dispatch, kerfWidth, optimizationStrategy, activeProfileType, projectId, building.id, savedPlan, savePlanMutation, updatePlanMutation]);

  const handleApplyPlan = useCallback(async () => {
    if (!state.cuttingPlan || !activeProfileType || !activePool) return;

    // If there's already an applied plan, show confirmation dialog
    if (appliedPlan) {
      setShowReapplyConfirm(true);
      return;
    }

    await doApplyPlan();
  }, [state.cuttingPlan, activeProfileType, activePool, appliedPlan]);

  const doApplyPlan = useCallback(async () => {
    if (!state.cuttingPlan || !activeProfileType || !activePool) return;

    // Use the existing saved plan if we have one, otherwise save first
    let planId = loadedPlanId;

    if (!planId) {
      const color = activePool.stock[0]?.color ?? "#000000";
      const saved = await savePlanMutation.mutateAsync({
        projectId,
        data: {
          scope: "building",
          scopeId: building.id,
          profileType: activeProfileType,
          color,
          bars: state.cuttingPlan.bars,
          summary: state.cuttingPlan.summary,
          kerfWidth,
          strategy: optimizationStrategy,
        },
      });
      planId = saved.id;
    }

    // Apply the saved plan
    await applyMutation.mutateAsync({
      projectId,
      planId: planId!,
    });

    setLoadedPlanId(planId);
  }, [state.cuttingPlan, activeProfileType, activePool, projectId, building.id, kerfWidth, optimizationStrategy, loadedPlanId, savePlanMutation, applyMutation]);

  const handleUnapplyPlan = useCallback(async () => {
    if (!appliedPlan) return;
    await unapplyMutation.mutateAsync({
      projectId,
      planId: appliedPlan.id,
    });
    // Plan still exists in DB, just not applied — keep loadedPlanId
  }, [appliedPlan, projectId, unapplyMutation]);

  const handleClearPlan = useCallback(async () => {
    if (!savedPlan) {
      dispatch({ type: ACTIONS.CLEAR_PLAN });
      setHasOptimized(false);
      return;
    }
    // If plan is applied, can't delete — un-apply first
    if (savedPlan.isApplied) return;
    await deletePlanMutation.mutateAsync({
      projectId,
      planId: savedPlan.id,
    });
    setLoadedPlanId(null);
    setHasOptimized(false);
    dispatch({ type: ACTIONS.CLEAR_PLAN });
  }, [savedPlan, projectId, deletePlanMutation, dispatch]);

  // Reset optimized state when switching pools
  useEffect(() => {
    setHasOptimized(false);
    dispatch({ type: ACTIONS.CLEAR_PLAN });
  }, [activeProfileType, activeGroupId, dispatch]);

  // Load saved plan from DB into AppContext for visualization (applied or not)
  useEffect(() => {
    if (!savedPlan || !activePool || hasOptimized) return;

    const stockLengths = activePool.stock.map((s) => ({
      id: s.id,
      length: s.length ?? 0,
      quantity: s.quantity,
      isRemnant: s.isRemnant,
      label: s.label ?? "",
    }));

    dispatch({ type: ACTIONS.SET_STOCK_LENGTHS, payload: stockLengths });
    dispatch({
      type: ACTIONS.LOAD_PLAN,
      payload: {
        bars: JSON.parse(savedPlan.bars),
        summary: JSON.parse(savedPlan.summary),
      },
    });
    setLoadedPlanId(savedPlan.id);
    setHasOptimized(true);
  }, [savedPlan, activePool, hasOptimized, dispatch]);

  const isLoading = templateQueries.some((q) => q.isLoading);
  const isLoadingTemplate = !!activeGroupId && !templateDetail;
  const isLoadingSavedPlan = !!savedPlan && !state.isOptimized && !hasOptimized;

  if (isLoading || isLoadingTemplate || isLoadingPlans) {
    return <LoadingState label="Loading optimization data..." />;
  }

  if (allGroups.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No openings found. Make sure floor assignments and opening sizes are set.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Building navigation */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrev} disabled={!hasPrev}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} disabled={!hasNext}>
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
        <span className="text-sm font-medium">{building.name}</span>
        <span className="text-xs text-muted-foreground">
          {building.floors} floors × {building.apartmentsPerFloor} apts
        </span>
      </div>

      {/* Piece template group tabs + Profile type sub-tabs */}
      {isMobile ? (
        <div className="flex items-center gap-2">
          <Select value={activeGroupId ?? undefined} onValueChange={(v) => v && setActiveGroupId(v)}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
              <SelectValue>
                {allGroups.find((g) => g.pieceTemplateId === activeGroupId)?.pieceTemplateName ?? "Select..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allGroups.map((g) => (
                <SelectItem key={g.pieceTemplateId} value={g.pieceTemplateId}>{g.pieceTemplateName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {poolsWithStock && poolsWithStock.length > 0 && (
            <Select value={activeProfileType ?? undefined} onValueChange={(v) => v && setActiveProfileType(v)}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue>
                  {poolsWithStock.find((p) => p.profileType === activeProfileType)
                    ? `${profileTypeLabel(activeProfileType!)} (${poolsWithStock.find((p) => p.profileType === activeProfileType)!.pieces.reduce((s, pp) => s + pp.quantity, 0)} pcs)`
                    : "Select..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {poolsWithStock.map((p) => (
                  <SelectItem key={p.profileType} value={p.profileType}>
                    {profileTypeLabel(p.profileType)}
                    {p.stock.length === 0 && <span className="ml-1 text-amber-600">⚠</span>}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {p.pieces.reduce((s, pp) => s + pp.quantity, 0)} pcs
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5 shrink-0">
            {allGroups.map((g) => (
              <button
                key={g.pieceTemplateId}
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeGroupId === g.pieceTemplateId
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveGroupId(g.pieceTemplateId)}
              >
                {g.pieceTemplateName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile type sub-tabs + Optimize button */}
      {poolsWithStock && poolsWithStock.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {!isMobile && (
              <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5 shrink-0">
                {poolsWithStock.map((p) => (
                  <button
                    key={p.profileType}
                    type="button"
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      activeProfileType === p.profileType
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveProfileType(p.profileType)}
                  >
                    {profileTypeLabel(p.profileType)}
                    {p.stock.length === 0 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">⚠</span>
                    )}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {p.pieces.reduce((s, pp) => s + pp.quantity, 0)} pcs
                    </span>
                  </button>
                ))}
              </div>
            )}
            {demandChanged && savedPlan && (
              <Badge
                variant="outline"
                className={appliedPlan
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5 gap-1"
                  : "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/5 gap-1"}
              >
                <HugeiconsIcon icon={AlertCircleIcon} size={12} />
                <span className="hidden sm:inline">{appliedPlan ? "Sizes changed — un-apply & re-optimize" : "Sizes changed — re-optimize"}</span>
                <span className="sm:hidden">{appliedPlan ? "Sizes changed" : "Sizes changed"}</span>
              </Badge>
            )}
            {stockChanged && savedPlan && (
              <Badge
                variant="outline"
                className={appliedPlan
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/5 gap-1"
                  : "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/5 gap-1"}
              >
                <HugeiconsIcon icon={AlertCircleIcon} size={12} />
                <span className="hidden sm:inline">{appliedPlan ? "Stock changed — un-apply & re-optimize" : "Stock changed — re-optimize"}</span>
                <span className="sm:hidden">{appliedPlan ? "Stock changed" : "Stock changed"}</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap w-full md:w-auto">
            {savedPlan && !savedPlan.isApplied && !appliedPlan && (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive flex-1 md:flex-none"
                onClick={handleClearPlan}
                disabled={deletePlanMutation.isPending}
                title="Clear Plan"
              >
                <HugeiconsIcon icon={Delete02Icon} size={13} />
                {deletePlanMutation.isPending ? 'Clearing...' : 'Clear'}
              </Button>
            )}
            <Button
              className="flex-1 md:flex-none"
              onClick={handleOptimize}
              disabled={isOptimizing || !activePool || activePool.stock.length === 0 || !!appliedPlan}
              title={appliedPlan ? "Un-apply the current plan to re-optimize" : undefined}
            >
              <HugeiconsIcon
                icon={SparklesIcon}
                size={14}
                className={`mr-1.5 ${isOptimizing ? "animate-spin" : ""}`}
              />
              {isOptimizing ? "Working..." : "Optimize"}
            </Button>
            {savedPlans && savedPlans.length > 0 && (
              <Button
                variant="outline"
                className="flex-1 md:flex-none"
                onClick={() => setShowExportDialog(true)}
                title="Export all saved plans as PDF"
              >
                <HugeiconsIcon icon={FileDownloadIcon} size={14} className="mr-1.5" />
                Export All
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stock check warnings */}
      {activePool && activePool.stock.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="px-4 py-2 flex items-start gap-3">
            <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-amber-700 dark:text-amber-300">
                No stock found for {profileTypeLabel(activePool.profileType)}
                {activeProfileSystemKey ? ` (${activeProfileSystemKey})` : ""}.
              </span>
              <span className="text-xs text-muted-foreground">
                Add stock entries with this profile type in the Stock tab.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {activePool && activePool.stock.length > 0 && stockCheck && !stockCheck.sufficient && !savedPlan && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="px-4 py-2 flex items-start gap-3">
            <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-amber-700 dark:text-amber-300">
                Stock may be insufficient: {formatLength(stockCheck.totalStockLength)} available vs {formatLength(stockCheck.totalDemandLength)} needed.
              </span>
              <span className="text-xs text-muted-foreground">
                {stockCheck.barsEstimate
                  .filter((b) => b.shortfall > 0)
                  .map((b) => `~${b.needed}+ bars of ${b.label} needed (${b.available} available)`)
                  .join(" · ")} · zero waste assumed — actual may be higher.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shortage warning from optimizer */}
      {state.cuttingPlan?.unplaced && state.cuttingPlan.unplaced.count > 0 && (() => {
        const unplacedLength = state.cuttingPlan.unplaced.totalLength;
        const unplacedCount = state.cuttingPlan.unplaced.count;
        const unplacedWithKerf = unplacedLength + unplacedCount * kerfWidth;
        const largestStock = activePool?.stock
          ?.filter((s) => s.length && s.length > 0)
          .sort((a, b) => (b.length ?? 0) - (a.length ?? 0))[0];
        const additionalBars = largestStock
          ? Math.ceil(unplacedWithKerf / largestStock.length!)
          : null;
        return (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="px-4 py-2 flex items-start gap-3">
              <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  {unplacedCount} pieces ({Math.round(unplacedLength)}mm) couldn't be placed — insufficient stock.
                </span>
                <span className="text-xs text-muted-foreground">
                  {additionalBars !== null
                    ? `~${additionalBars}+ additional bars of ${largestStock!.label ?? `${largestStock!.length}mm`} needed · zero waste assumed`
                    : "Add more stock bars to fit all demand pieces."}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Summary stats before optimization */}
      {activePool && !state.isOptimized && activePool.stock.length > 0 && stockCheck && !savedPlan && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span><strong className="text-foreground">{activePool.pieces.reduce((s, p) => s + p.quantity, 0)}</strong> pieces</span>
          <span>·</span>
          <span><strong className="text-foreground">{activePool.stock.length}</strong> stock types</span>
          <span>·</span>
          <span>Kerf: <strong className="text-foreground">{kerfWidth}mm</strong></span>
          <span>·</span>
          <span>Goal: <strong className="text-foreground">{optimizationStrategy === "maximize_large_bars" ? "Maximize Large Bars" : "Balanced"}</strong></span>
        </div>
      )}

      {/* Results */}
      {state.isOptimized && state.cuttingPlan && (
        <ResultsPanel
          applyProps={{
            isApplied: !!appliedPlan,
            isSaved: !!savedPlan,
            isSaving: savePlanMutation.isPending || updatePlanMutation.isPending,
            isApplying: applyMutation.isPending,
            isUnapplying: unapplyMutation.isPending,
            onApply: handleApplyPlan,
            onUnapply: handleUnapplyPlan,
          }}
          exportProps={{
            projectName,
            buildingName: building.name,
            profileType: activeProfileType ?? "",
            profileTypeLabel: profileTypeLabel(activeProfileType ?? ""),
            piecePoolGroups,
            unit: displayUnit,
            unitLabel,
          }}
        />
      )}


      {/* Re-apply confirmation dialog */}
      <Dialog open={showReapplyConfirm} onOpenChange={setShowReapplyConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Applied Plan?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground py-2">
            A cutting plan is already applied for this building's {profileTypeLabel(activeProfileType ?? "")}.
            Applying a new plan will un-apply the old one first (restore consumed bars to stock),
            then apply the new plan (consume bars from stock).
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReapplyConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setShowReapplyConfirm(false);
                await doApplyPlan();
              }}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? "Applying..." : "Replace & Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading saved plan */}
      {isLoadingSavedPlan && (
        <LoadingState label="Loading saved plan..." />
      )}

      {/* Empty state */}
      {activePool && activePool.stock.length > 0 && !state.isOptimized && !isLoadingSavedPlan && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <HugeiconsIcon icon={ScissorIcon} size={32} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Click "Optimize" to run the cutting optimizer for {profileTypeLabel(activePool.profileType)} pieces.
            </p>
          </CardContent>
        </Card>
      )}

      <ExportAllDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        projectName={projectName}
        buildingName={building.name}
        savedPlans={savedPlans ?? []}
        piecePoolGroups={piecePoolGroups}
        unit={displayUnit}
        unitLabel={unitLabel}
        getRGBForLength={getRGBForLength}
        getStockById={(id) => stockLookup.get(id) ?? null}
        profileTypeLabel={profileTypeLabel}
      />
    </div>
  );
}
