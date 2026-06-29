import axios, { AxiosInstance } from 'axios';
import { FindingTicketPayload, FindingTicketResult, JiraProject, RecentTicket } from '@identityhub/shared';
import { buildJiraIssueFields } from './mappers';

export class JiraUserClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(accessToken: string, cloudId: string, baseUrl: string) {
    this.baseUrl = baseUrl;
    this.http = axios.create({
      baseURL: `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async getProjects(): Promise<JiraProject[]> {
    const res = await this.http.get('/project');
    return res.data.map((p: { id: string; key: string; name: string }) => ({
      id: p.id,
      key: p.key,
      name: p.name,
    }));
  }

  async createFinding(payload: FindingTicketPayload): Promise<FindingTicketResult> {
    const res = await this.http.post('/issue', { fields: buildJiraIssueFields(payload) });
    return {
      id: res.data.id,
      key: res.data.key,
      url: `${this.baseUrl}/browse/${res.data.key}`,
      createdAt: new Date().toISOString(),
    };
  }

  async getRecentFindings(projectKey: string): Promise<RecentTicket[]> {
    const jql = `project = "${projectKey}" AND labels = "identityhub" ORDER BY created DESC`;
    const res = await this.http.get('/search', {
      params: { jql, maxResults: 10, fields: 'summary,created' },
    });
    return res.data.issues.map((issue: {
      id: string; key: string;
      fields: { summary: string; created: string };
    }) => ({
      id: issue.id,
      key: issue.key,
      title: issue.fields.summary,
      url: `${this.baseUrl}/browse/${issue.key}`,
      createdAt: issue.fields.created,
    }));
  }
}
