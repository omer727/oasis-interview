import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { RecentTicket } from '../../../shared/src/types';

export function useRecentTickets(projectKey: string) {
  return useQuery<RecentTicket[]>({
    queryKey: ['jira', 'recent', projectKey],
    queryFn: () => apiFetch<RecentTicket[]>(`/api/jira/projects/${projectKey}/recent-findings`),
    enabled: !!projectKey,
    staleTime: 30 * 1000,
  });
}
