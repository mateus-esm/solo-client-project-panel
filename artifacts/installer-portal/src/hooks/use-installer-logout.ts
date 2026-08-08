import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

export function useInstallerLogout() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/installer/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to logout');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation('/login');
    },
  });
}
