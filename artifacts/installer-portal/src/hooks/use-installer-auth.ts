import { useQuery } from '@tanstack/react-query';

export interface InstallerAuth {
  name: string;
  email: string;
  teamName: string;
}

export function useInstallerAuth() {
  const { data, isLoading, error } = useQuery<{ ok: boolean } & InstallerAuth>({
    queryKey: ['installer', 'auth'],
    queryFn: async () => {
      const res = await fetch('/api/installer/auth/check', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        throw new Error('Not authenticated');
      }
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isAuthenticated: !!data?.ok,
    installer: data,
    isLoading,
    error,
  };
}
