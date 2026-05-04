import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export const ADMIN_AUTH_KEY = ["admin", "auth"] as const;

async function checkAdmin(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/admin/auth/check", { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

async function adminLogout(): Promise<void> {
  await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
}

export function useAdminAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_AUTH_KEY,
    queryFn: checkAdmin,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  return { isAuthenticated: !!data?.ok && !error, isLoading };
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  return useMutation({
    mutationFn: adminLogout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/admin/login");
    },
  });
}
