import { buildJiraIssueFields } from '../jira/mappers';
import { FindingTicketPayload } from '@identityhub/shared';

const base: FindingTicketPayload = {
  projectKey: 'OPS',
  title: 'Stale Service Account: svc-deploy',
  description: 'Last active 90 days ago',
  severity: 'high',
  findingType: 'stale-credential',
  identityType: 'service-account',
};

describe('buildJiraIssueFields', () => {
  it('maps critical severity to Highest priority', () => {
    const fields = buildJiraIssueFields({ ...base, severity: 'critical' });
    expect(fields.priority.name).toBe('Highest');
  });

  it('maps high severity to High priority', () => {
    const fields = buildJiraIssueFields(base);
    expect(fields.priority.name).toBe('High');
  });

  it('maps medium severity to Medium priority', () => {
    const fields = buildJiraIssueFields({ ...base, severity: 'medium' });
    expect(fields.priority.name).toBe('Medium');
  });

  it('maps low severity to Low priority', () => {
    const fields = buildJiraIssueFields({ ...base, severity: 'low' });
    expect(fields.priority.name).toBe('Low');
  });

  it('always includes identityhub label', () => {
    const fields = buildJiraIssueFields(base);
    expect(fields.labels).toContain('identityhub');
  });

  it('includes type label with prefix', () => {
    const fields = buildJiraIssueFields({ ...base, findingType: 'overprivileged' });
    expect(fields.labels).toContain('type:overprivileged');
  });

  it('includes identity label with prefix', () => {
    const fields = buildJiraIssueFields({ ...base, identityType: 'api-key' });
    expect(fields.labels).toContain('identity:api-key');
  });

  it('wraps description in ADF format', () => {
    const fields = buildJiraIssueFields(base);
    expect(fields.description.type).toBe('doc');
    expect(fields.description.version).toBe(1);
    expect(fields.description.content[0].content[0].text).toBe(base.description);
  });
});
