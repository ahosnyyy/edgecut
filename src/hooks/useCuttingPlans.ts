import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface CuttingPlan {
  id: string;
  projectId: string;
  scope: "project" | "building" | "level" | "apartment";
  scopeId: string | null;
  profileType: string;
  color: string;
  bars: string;
  summary: string;
  kerfWidth: number;
  strategy: string;
  isApplied: boolean;
  createdAt: number;
}

export function useCuttingPlans(
  projectId: string | undefined,
  scope?: string,
  scopeId?: string,
) {
  return useQuery<CuttingPlan[]>({
    queryKey: ["cutting-plans", projectId, scope, scopeId],
    queryFn: () => {
      let url = `/api/projects/${projectId}/cutting-plans`;
      const params: string[] = [];
      if (scope) params.push(`scope=${scope}`);
      if (scopeId) params.push(`scopeId=${scopeId}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      return apiFetch<CuttingPlan[]>(url);
    },
    enabled: !!projectId,
  });
}

export function useSaveCuttingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        scope: "project" | "building" | "level" | "apartment";
        scopeId?: string | null;
        profileType: string;
        color: string;
        bars: unknown;
        summary: unknown;
        kerfWidth: number;
        strategy: string;
      };
    }) =>
      apiFetch<{ id: string; isApplied: boolean }>(
        `/api/projects/${projectId}/cutting-plans`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["cutting-plans", vars.projectId],
      });
    },
  });
}

export function useUpdateCuttingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      planId,
      data,
    }: {
      projectId: string;
      planId: string;
      data: {
        bars?: unknown;
        summary?: unknown;
        kerfWidth?: number;
        strategy?: string;
      };
    }) =>
      apiFetch<{ id: string; updated: boolean }>(
        `/api/projects/${projectId}/cutting-plans/${planId}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["cutting-plans", vars.projectId],
      });
    },
  });
}

export function useApplyCuttingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      planId,
    }: {
      projectId: string;
      planId: string;
    }) =>
      apiFetch<{ id: string; isApplied: boolean }>(
        `/api/projects/${projectId}/cutting-plans/${planId}/apply`,
        { method: "POST" },
      ),
    onSuccess: (_data, vars) => {
      qc.setQueriesData(
        { queryKey: ["cutting-plans", vars.projectId] },
        (old: CuttingPlan[] | undefined) =>
          old ? old.map((p) => ({ ...p, isApplied: p.id === vars.planId ? true : p.isApplied })) : old,
      );
      qc.invalidateQueries({
        queryKey: ["cutting-plans", vars.projectId],
      });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
      qc.invalidateQueries({
        queryKey: ["project-stock", vars.projectId],
      });
      qc.invalidateQueries({ queryKey: ["dashboard", "stock-coverage"] });
    },
  });
}

export function useUnapplyCuttingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      planId,
    }: {
      projectId: string;
      planId: string;
    }) =>
      apiFetch<{ id: string; isApplied: boolean }>(
        `/api/projects/${projectId}/cutting-plans/${planId}/unapply`,
        { method: "POST" },
      ),
    onSuccess: (_data, vars) => {
      qc.setQueriesData(
        { queryKey: ["cutting-plans", vars.projectId] },
        (old: CuttingPlan[] | undefined) =>
          old ? old.map((p) => ({ ...p, isApplied: p.id === vars.planId ? false : p.isApplied })) : old,
      );
      qc.invalidateQueries({
        queryKey: ["cutting-plans", vars.projectId],
      });
      qc.invalidateQueries({ queryKey: ["stock-catalog"] });
      qc.invalidateQueries({
        queryKey: ["project-stock", vars.projectId],
      });
      qc.invalidateQueries({ queryKey: ["dashboard", "stock-coverage"] });
    },
  });
}

export function useDeleteCuttingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      planId,
    }: {
      projectId: string;
      planId: string;
    }) =>
      apiFetch<{ deleted: boolean }>(
        `/api/projects/${projectId}/cutting-plans/${planId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_data, vars) => {
      qc.setQueriesData(
        { queryKey: ["cutting-plans", vars.projectId] },
        (old: CuttingPlan[] | undefined) =>
          old ? old.filter((p) => p.id !== vars.planId) : old,
      );
      qc.invalidateQueries({
        queryKey: ["cutting-plans", vars.projectId],
      });
    },
  });
}
