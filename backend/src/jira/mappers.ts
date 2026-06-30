import { FindingTicketPayload, Severity } from '@identityhub/shared';

const SEVERITY_PRIORITY: Record<Severity, string> = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_SEVERITY: Record<string, Severity> = {
  Highest: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

export function priorityToSeverity(priorityName: string): Severity | undefined {
  return PRIORITY_SEVERITY[priorityName];
}

export function toAdf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text }],
    }],
  };
}

export function buildJiraIssueFields(payload: FindingTicketPayload) {
  return {
    project: { key: payload.projectKey },
    summary: payload.title,
    description: toAdf(payload.description),
    issuetype: { name: 'Task' },
    priority: { name: SEVERITY_PRIORITY[payload.severity] },
    labels: [
      'identityhub',
      `type:${payload.findingType}`,
      `identity:${payload.identityType}`,
    ],
  };
}
