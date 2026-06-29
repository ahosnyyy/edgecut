import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface ProfileType {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isReserved: boolean;
  createdAt: number;
}

export function useProfileTypes() {
  return useQuery<ProfileType[]>({
    queryKey: ["profile-types"],
    queryFn: () => apiFetch<ProfileType[]>("/api/profile-types"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProfileType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; label: string }) =>
      apiFetch<{ id: string }>("/api/profile-types", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-types"] });
    },
  });
}

export function useUpdateProfileType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiFetch<{ ok: boolean }>(`/api/profile-types/${id}`, {
        method: "PUT",
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-types"] });
    },
  });
}

export function useDeleteProfileType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/profile-types/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-types"] });
    },
  });
}
