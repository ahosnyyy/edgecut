import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface Project {
  id: string;
  name: string;
  client: string | null;
  status: "draft" | "active" | "completed" | "archived";
  notes: string | null;
  floors: number;
  apartmentsPerFloor: number;
  apartmentLabels: string;
  buildingCount: number;
  completedBuildings: number;
  // Optimizer settings
  measurementSystem: "metric" | "imperial";
  unit: string;
  kerfWidth: number;
  pricePerBar: number;
  optimizationStrategy: "balanced" | "maximize_large_bars";
  profileSystem: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Building {
  id: string;
  projectId: string;
  name: string;
  floors: number;
  apartmentsPerFloor: number;
  apartmentLabels: string;
  sortOrder: number;
  status: "draft" | "active" | "completed" | "archived";
  createdAt: number;
}

export interface FloorAssignment {
  id: string;
  projectId: string;
  buildingId: string;
  floor: number;
  apartmentIndex: number;
  apartmentTemplateId: string | null;
}

export interface OpeningSize {
  id: string;
  projectId: string;
  buildingId: string;
  apartmentTemplateOpeningId: string;
  floor: number;
  apartmentIndex: number;
  width: number;
  height: number;
}

export interface ProjectDetail extends Project {
  buildings: Building[];
  assignments: FloorAssignment[];
  openingSizes: OpeningSize[];
}

export interface OptimizationPool {
  pieceTemplateId: string;
  templateName: string;
  profileType: string;
  profileSystemKey: string | null;
  pieces: { label: string; length: number; quantity: number; source: string }[];
}

export interface ProjectPieces {
  project: Project;
  buildings: Building[];
  pools: OptimizationPool[];
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>("/api/projects"),
  });
}

export function useProject(id: string | null) {
  return useQuery<ProjectDetail>({
    queryKey: ["project", id],
    queryFn: () => apiFetch<ProjectDetail>(`/api/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      client?: string;
      notes?: string;
    }) => apiFetch<{ id: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Project, "name" | "client" | "notes" | "status" | "measurementSystem" | "unit" | "kerfWidth" | "pricePerBar" | "optimizationStrategy" | "profileSystem">>;
    }) =>
      apiFetch<{ id: string }>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/projects/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

export function useCreateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        floors?: number;
        apartmentsPerFloor?: number;
        apartmentLabels?: string[];
      };
    }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/buildings`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useUpdateBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
      data,
    }: {
      projectId: string;
      buildingId: string;
      data: Partial<Pick<Building, "name" | "floors" | "apartmentsPerFloor" | "status">> & {
        apartmentLabels?: string[];
      };
    }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/buildings/${buildingId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
    }: {
      projectId: string;
      buildingId: string;
    }) =>
      apiFetch<{ deleted: boolean }>(`/api/projects/${projectId}/buildings/${buildingId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useSaveAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
      assignments,
    }: {
      projectId: string;
      buildingId: string;
      assignments: {
        floor: number;
        apartmentIndex: number;
        apartmentTemplateId: string | null;
      }[];
    }) =>
      apiFetch<{ saved: boolean }>(`/api/projects/${projectId}/buildings/${buildingId}/assignments`, {
        method: "PUT",
        body: JSON.stringify({ assignments }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useSaveOpeningSizes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      buildingId,
      sizes,
    }: {
      projectId: string;
      buildingId: string;
      sizes: {
        apartmentTemplateOpeningId: string;
        floor: number;
        apartmentIndex: number;
        width: number;
        height: number;
      }[];
    }) =>
      apiFetch<{ saved: boolean }>(`/api/projects/${projectId}/buildings/${buildingId}/opening-sizes`, {
        method: "PUT",
        body: JSON.stringify({ sizes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useProjectPieces(projectId: string | null) {
  return useQuery<ProjectPieces>({
    queryKey: ["project-pieces", projectId],
    queryFn: () => apiFetch<ProjectPieces>(`/api/projects/${projectId}/pieces`),
    enabled: !!projectId,
  });
}

// ─── Stock ───────────────────────────────────────────────────────────────────

export interface StockEntry {
  id: string;
  projectId: string;
  profileSystem: string | null;
  profileType: string;
  color: string;
  length: number | null;
  label: string | null;
  quantity: number;
  isRemnant: boolean;
  sourceDefaultId: string | null;
}

export function useProjectStock(projectId: string | null) {
  return useQuery<StockEntry[]>({
    queryKey: ["project-stock", projectId],
    queryFn: () => apiFetch<StockEntry[]>(`/api/projects/${projectId}/stock`),
    enabled: !!projectId,
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: Omit<StockEntry, "id" | "projectId" | "profileSystem"> & { profileSystem?: string | null };
    }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/stock`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-stock", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      stockId,
      data,
    }: {
      projectId: string;
      stockId: string;
      data: Partial<Omit<StockEntry, "id" | "projectId">>;
    }) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/stock/${stockId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-stock", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

export function useDeleteStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      stockId,
    }: {
      projectId: string;
      stockId: string;
    }) =>
      apiFetch<{ deleted: boolean }>(`/api/projects/${projectId}/stock/${stockId}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-stock", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

// ─── Stock Catalog (global templates) ────────────────────────────────────────

export interface StockCatalogEntry {
  id: string;
  profileSystem: "manazil" | "premier";
  profileType: string;
  color: string;
  length: number;
  quantity: number;
  reservedQty: number;
  usedQty: number;
  label: string | null;
}

export function useStockCatalog(profileSystems?: string[]) {
  const key = profileSystems?.slice().sort().join(",") ?? "all";
  const queryKey = ["stock-catalog", key];

  return useQuery<StockCatalogEntry[]>({
    queryKey,
    queryFn: () => {
      if (!profileSystems || profileSystems.length === 0) {
        return apiFetch<StockCatalogEntry[]>(`/api/stock-catalog`);
      }
      const params = profileSystems.map((s) => `profileSystem=${s}`).join("&");
      return apiFetch<StockCatalogEntry[]>(`/api/stock-catalog?${params}`);
    },
  });
}

export function useAddStockCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<StockCatalogEntry, "id" | "reservedQty" | "usedQty">) =>
      apiFetch<{ id: string }>(`/api/stock-catalog`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

export function useUpdateStockCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<StockCatalogEntry, "id">>;
    }) =>
      apiFetch<{ id: string }>(`/api/stock-catalog/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}

export function useDeleteStockCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/stock-catalog/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
    },
  });
}
