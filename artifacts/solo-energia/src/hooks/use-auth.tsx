import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, logout } from "@workspace/api-client-react";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => getMe(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isAuthenticated = !!user && !error;

  return { user, isLoading, isAuthenticated };
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });
}
