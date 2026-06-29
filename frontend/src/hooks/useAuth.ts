import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiRequestError } from '../api/client';
import type { AppUser } from '../../../shared/src/types';

export function useAuth() {
  const { data: user, isLoading } = useQuery<AppUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await apiFetch<AppUser>('/api/auth/me');
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  return { user: user ?? null, isLoading };
}
