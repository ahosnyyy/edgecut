import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface Template {
  id: string;
  name: string;
  type: "window" | "door";
  category: string;
  profileSystemId: string | null;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateVariable {
  id: string;
  templateId: string;
  name: string;
  label: string;
  defaultValue: number;
  sortOrder: number;
}

export interface TemplatePiece {
  id: string;
  templateId: string;
  label: string;
  profileType: "frame" | "sash" | "mullion" | "bead" | "custom";
  lengthFormula: string;
  quantity: number;
  sortOrder: number;
}

export interface TemplateDetail extends Template {
  variables: TemplateVariable[];
  pieces: TemplatePiece[];
}

export function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => apiFetch<Template[]>("/api/templates"),
  });
}

export function useTemplate(id: string | null) {
  return useQuery<TemplateDetail>({
    queryKey: ["template", id],
    queryFn: () => apiFetch<TemplateDetail>(`/api/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      type: "window" | "door";
      profileSystemId?: string | null;
      variables?: { name: string; label: string; defaultValue: number }[];
      pieces?: {
        label: string;
        profileType: string;
        lengthFormula: string;
        quantity: number;
      }[];
    }) => apiFetch<{ id: string }>("/api/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        type?: "window" | "door";
        category?: string;
        profileSystemId?: string | null;
        variables?: { name: string; label: string; defaultValue: number }[];
        pieces?: {
          label: string;
          profileType: string;
          lengthFormula: string;
          quantity: number;
        }[];
      };
    }) =>
      apiFetch<{ id: string }>(`/api/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["template", vars.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/templates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDuplicateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/templates/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
