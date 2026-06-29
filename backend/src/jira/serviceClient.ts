import axios, { AxiosInstance } from 'axios';
import { FindingTicketPayload, FindingTicketResult } from '@identityhub/shared';
import { buildJiraIssueFields } from './mappers';

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
}
