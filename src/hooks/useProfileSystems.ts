import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface SystemConstant {
  name: string;
  label: string;
  defaultValue: number;
}

export interface DefaultPiece {
  label: string;
  profileType: string;
  lengthFormula: string;
  quantity: number;
}

export interface ProfileSystem {
  id: string;
  name: string;
  key: string;
  constants: string;
  defaultPieces: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileSystemInput {
  name: string;
  key: string;
  constants: SystemConstant[];
  defaultPieces?: DefaultPiece[];
}

export function useProfileSystems() {
  return useQuery<ProfileSystem[]>({
    queryKey: ["profile-systems"],
    queryFn: () => apiFetch<ProfileSystem[]>("/api/profile-systems"),
  });
}

export function useProfileSystem(id: string | null) {
  return useQuery<ProfileSystem>({
    queryKey: ["profile-systems", id],
    queryFn: () => apiFetch<ProfileSystem>(`/api/profile-systems/${id}`),
    enabled: !!id,
  });
}

export function useCreateProfileSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileSystemInput) =>
      apiFetch<{ id: string }>("/api/profile-systems", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-systems"] });
    },
  });
}

export function useUpdateProfileSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProfileSystemInput> }) =>
      apiFetch<{ id: string }>(`/api/profile-systems/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-systems"] });
    },
  });
}

export function useDeleteProfileSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/profile-systems/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-systems"] });
    },
  });
}
