import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      displayName: string;
      avatarUrl?: string;
    };
    jira?: {
      accessToken: string;
      refreshToken: string;
      cloudId: string;
      baseUrl: string;
    };
    jiraOAuthState?: string;
  }
}
