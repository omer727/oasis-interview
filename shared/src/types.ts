export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingType = 'stale-credential' | 'overprivileged' | 'expiring-credential' | 'misconfigured';
export type IdentityType = 'service-account' | 'api-key' | 'service-principal' | 'oauth-app';

export interface FindingTicketPayload {
  projectKey: string;
  title: string;
  description: string;
  severity: Severity;
  findingType: FindingType;
  identityType: IdentityType;
}

export interface FindingTicketResult {
  id: string;
  key: string;
  url: string;
  createdAt: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface RecentTicket {
  id: string;
  key: string;
  title: string;
  url: string;
  createdAt: string;
  severity?: Severity;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface JiraStatus {
  connected: boolean;
  baseUrl?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
