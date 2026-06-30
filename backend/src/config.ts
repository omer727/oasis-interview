function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  sessionSecret: requireEnv('SESSION_SECRET'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    callbackUrl: requireEnv('GOOGLE_CALLBACK_URL'),
  },
  jira: {
    clientId: requireEnv('JIRA_CLIENT_ID'),
    clientSecret: requireEnv('JIRA_CLIENT_SECRET'),
    callbackUrl: requireEnv('JIRA_CALLBACK_URL'),
  },
  jiraService: {
    email: requireEnv('JIRA_SERVICE_ACCOUNT_EMAIL'),
    token: requireEnv('JIRA_SERVICE_ACCOUNT_TOKEN'),
    baseUrl: requireEnv('JIRA_SERVICE_BASE_URL'),
  },
  apiKey: requireEnv('API_KEY'),
  digest: {
    claudeApiKey: process.env.CLAUDE_API_KEY,
    projectKey: process.env.JIRA_BLOG_DIGEST_PROJECT_KEY,
  },
};
