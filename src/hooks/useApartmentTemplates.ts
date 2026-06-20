import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface ApartmentTemplate {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ApartmentTemplateOpening {
  id: string;
  label: string;
  pieceTemplateId: string;
  sortOrder: number;
  templateName: string;
  templateType: string;
}

export interface ApartmentTemplateDetail extends ApartmentTemplate {
  openings: ApartmentTemplateOpening[];
}

export function useApartmentTemplates() {
  return useQuery<ApartmentTemplate[]>({
    queryKey: ["apartment-templates"],
    queryFn: () => apiFetch<ApartmentTemplate[]>("/api/apartment-templates"),
  });
}

export function useApartmentTemplate(id: string | null) {
  return useQuery<ApartmentTemplateDetail>({
    queryKey: ["apartment-template", id],
    queryFn: () => apiFetch<ApartmentTemplateDetail>(`/api/apartment-templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateApartmentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      openings?: { label: string; pieceTemplateId: string }[];
    }) => apiFetch<{ id: string }>("/api/apartment-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apartment-templates"] }),
  });
}

export function useUpdateApartmentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        description?: string;
        openings?: { label: string; pieceTemplateId: string }[];
      };
    }) =>
      apiFetch<{ id: string }>(`/api/apartment-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["apartment-templates"] });
      qc.invalidateQueries({ queryKey: ["apartment-template", vars.id] });
    },
  });
}

export function useDeleteApartmentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/apartment-templates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apartment-templates"] }),
  });
}
