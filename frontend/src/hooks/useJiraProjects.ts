import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { JiraProject } from '../../../shared/src/types';

export function useJiraProjects(enabled: boolean) {
  return useQuery<JiraProject[]>({
    queryKey: ['jira', 'projects'],
    queryFn: () => apiFetch<JiraProject[]>('/api/jira/projects'),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
