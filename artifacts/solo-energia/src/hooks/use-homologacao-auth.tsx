import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export const HOMOLOGACAO_AUTH_KEY = ["homologacao", "auth"] as const;

interface TechnicianInfo {
  ok: boolean;
  name: string;
  email: string;
}

async function checkHomologacaoAuth(): Promise<TechnicianInfo> {
  const res = await fetch("/api/homologacao/auth/check", { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

async function homologacaoLogout(): Promise<void> {
  await fetch("/api/homologacao/auth/logout", { method: "POST", credentials: "include" });
}

export function useHomologacaoAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: HOMOLOGACAO_AUTH_KEY,
    queryFn: checkHomologacaoAuth,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return {
    isAuthenticated: !!data?.ok && !error,
    isLoading,
    technician: data,
  };
}

export function useHomologacaoLogout() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  return useMutation({
    mutationFn: homologacaoLogout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/homologacao/login");
    },
  });
}
