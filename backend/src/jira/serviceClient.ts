import axios, { AxiosInstance } from 'axios';
import { FindingTicketPayload, FindingTicketResult } from '@identityhub/shared';
import { buildJiraIssueFields, toAdf } from './mappers';

export class JiraServiceClient {
  private http: AxiosInstance;
  private baseUrl: string;

  constructor(email: string, token: string, baseUrl: string) {
    this.baseUrl = baseUrl;
    const credentials = Buffer.from(`${email}:${token}`).toString('base64');
    this.http = axios.create({
      baseURL: `${baseUrl}/rest/api/3`,
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
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

  async ticketExistsForLabel(label: string): Promise<boolean> {
    const res = await this.http.post('/search/jql', {
      jql: `labels = "${label}"`,
      maxResults: 1,
      fields: ['id'],
    });
    return res.data.issues.length > 0;
  }

  async createDigestTicket(title: string, summary: string, projectKey: string, label: string): Promise<string> {
    const res = await this.http.post('/issue', {
      fields: {
        project: { key: projectKey },
        summary: title,
        description: toAdf(summary),
        issuetype: { name: 'Task' },
        labels: ['identityhub', label],
      },
    });
    return `${this.baseUrl}/browse/${res.data.key}`;
  }
}
