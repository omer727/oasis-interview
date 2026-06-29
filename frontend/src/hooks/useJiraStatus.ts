import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { JiraStatus } from '../../../shared/src/types';

export function useJiraStatus() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<JiraStatus>({
    queryKey: ['jira', 'status'],
    queryFn: () => apiFetch<JiraStatus>('/api/jira/status'),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch('/api/jira/disconnect', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
    },
  });

  return {
    status: status ?? { connected: false },
    isLoading,
    disconnect: disconnect.mutate,
    isDisconnecting: disconnect.isPending,
  };
}
