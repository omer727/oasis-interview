# IdentityHub Jira Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack PoC that lets IdentityHub users report NHI findings to their Jira workspace, with a REST API for CI/CD pipeline integration.

**Architecture:** Express backend with two Jira auth paths — per-user OAuth 2.0 (3LO) for the UI and a shared service-account (Basic auth) for the programmatic REST API. In-memory sessions via express-session. No database — API key and Jira service-account credentials come from `.env`. React/shadcn frontend in a monorepo.

**Tech Stack:** TypeScript (strict), Express 4, express-session, Passport.js (`passport-google-oauth20`), axios, React 18, Vite, Tailwind CSS, shadcn/ui, @tanstack/react-query, Jest, supertest, ts-jest

## Global Constraints

- TypeScript strict mode on both frontend and backend
- All API error responses: `{ "error": { "code": "SCREAMING_SNAKE", "message": "human string" } }`
- Every Finding Ticket tagged with labels: `identityhub`, `type:<findingType>`, `identity:<identityType>`
- Jira description field uses Atlassian Document Format (ADF), not plain text
- Session cookies: `httpOnly: true`, `sameSite: 'lax'`
- No database — in-memory sessions, env-var API key
- Backend port: 3001. Frontend dev server port: 5173
- Node ≥ 20

---

## File Map

```
/
├── package.json                          root workspace scripts (concurrently)
├── .env.example
├── .gitignore
├── CONTEXT.md
├── docs/
│   ├── adr/0001-dual-jira-auth.md
│   └── superpowers/plans/               (this file)
│
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── types.ts                     shared TS interfaces (both sides import from here)
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   └── src/
│       ├── app.ts                       Express app factory (exported for testing)
│       ├── index.ts                     server entry point (calls app(), listens)
│       ├── config.ts                    load + validate all env vars, fail fast if missing
│       ├── types/
│       │   └── session.ts               express-session module augmentation
│       ├── auth/
│       │   ├── google.ts                Passport Google OAuth strategy setup
│       │   └── middleware.ts            requireAuth, requireJiraConnected middlewares
│       ├── jira/
│       │   ├── userClient.ts            JiraUserClient — OAuth Bearer, cloud API
│       │   ├── serviceClient.ts         JiraServiceClient — Basic auth, direct URL
│       │   └── mappers.ts               severity→priority, findingType/identityType→labels, text→ADF
│       ├── routes/
│       │   ├── auth.ts                  /api/auth/* (Google OAuth, me, logout)
│       │   ├── jiraAuth.ts              /api/jira/connect|callback|disconnect|status
│       │   ├── jira.ts                  /api/jira/projects, /api/jira/findings, /api/jira/projects/:key/recent-findings
│       │   └── findings.ts              /api/v1/findings (REST API, API-key protected)
│       ├── middleware/
│       │   └── apiKey.ts                X-API-Key validation middleware
│       └── __tests__/
│           ├── auth.middleware.test.ts
│           ├── jira.mappers.test.ts
│           └── findings.api.test.ts
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                   proxies /api → localhost:3001
    ├── index.html
    ├── tailwind.config.ts
    ├── postcss.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx                      routes: /login, /dashboard (protected)
        ├── api/
        │   └── client.ts                typed fetch wrapper (throws on non-2xx)
        ├── hooks/
        │   ├── useAuth.ts               GET /api/auth/me
        │   ├── useJiraStatus.ts         GET /api/jira/status
        │   ├── useJiraProjects.ts       GET /api/jira/projects
        │   └── useRecentTickets.ts      GET /api/jira/projects/:key/recent-findings
        └── components/
            ├── LoginPage.tsx
            ├── Dashboard.tsx            project selector + wires form + tickets together
            ├── Header.tsx               user info + connect/disconnect Jira
            ├── CreateFindingForm.tsx    form for creating a Finding Ticket
            └── RecentTickets.tsx        last 10 tickets list
```

---

### Task 1: Monorepo scaffold + shared types

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`

**Interfaces:**
- Produces: `FindingTicketPayload`, `FindingTicketResult`, `JiraProject`, `RecentTicket`, `AppUser`, `JiraStatus` — all imported by backend and frontend

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "identityhub-jira",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\"",
    "install:all": "npm install && npm install --prefix shared && npm install --prefix backend && npm install --prefix frontend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create `.env.example`**

```bash
# App
PORT=3001
SESSION_SECRET=change-me-to-a-random-32-char-string
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Google OAuth — create at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Jira OAuth (per-user) — create at https://developer.atlassian.com/console/myapps/
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_CALLBACK_URL=http://localhost:3001/api/jira/callback

# Jira Service Account (for programmatic REST API)
# Generate token at https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_SERVICE_ACCOUNT_EMAIL=
JIRA_SERVICE_ACCOUNT_TOKEN=
JIRA_SERVICE_BASE_URL=https://your-domain.atlassian.net

# REST API — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY=
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.env
*.js.map
```

- [ ] **Step 4: Create `shared/package.json`**

```json
{
  "name": "@identityhub/shared",
  "version": "1.0.0",
  "main": "src/types.ts",
  "types": "src/types.ts"
}
```

- [ ] **Step 5: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `shared/src/types.ts`**

```typescript
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
```

- [ ] **Step 7: Commit**

```bash
git init
git add package.json .env.example .gitignore shared/
git commit -m "feat: monorepo scaffold and shared types"
```

---

### Task 2: Backend bootstrap

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.ts`
- Create: `backend/src/config.ts`
- Create: `backend/src/types/session.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`

**Interfaces:**
- Consumes: nothing yet
- Produces: `app` (Express Application) exported from `app.ts`; `config` object exported from `config.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "identityhub-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "connect-session-sequelize": "^7.1.7",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/passport": "^1.0.16",
    "@types/passport-google-oauth20": "^2.0.14",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.4",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@identityhub/shared": ["../shared/src/types.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '@identityhub/shared': '<rootDir>/../shared/src/types.ts',
  },
};

export default config;
```

- [ ] **Step 4: Create `backend/src/config.ts`**

```typescript
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
};
```

- [ ] **Step 5: Create `backend/src/types/session.ts`**

```typescript
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
  }
}
```

- [ ] **Step 6: Create `backend/src/app.ts`**

```typescript
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { config } from './config';
import './types/session';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));

  app.use(express.json());

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Routes mounted in later tasks
  app.get('/health', (_req, res) => res.json({ ok: true }));

  return app;
}
```

- [ ] **Step 7: Create `backend/src/index.ts`**

```typescript
import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
});
```

- [ ] **Step 8: Install backend dependencies**

```bash
cd backend && npm install
```

- [ ] **Step 9: Copy `.env.example` to `.env` and fill in values, then test the health endpoint**

```bash
cp .env.example .env
# Fill in SESSION_SECRET at minimum for now (other values can be placeholder strings)
cd backend && npm run dev
```

Expected: `Backend running on http://localhost:3001`
```bash
curl http://localhost:3001/health
```
Expected: `{"ok":true}`

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat: bootstrap Express backend with session middleware"
```

---

### Task 3: Google OAuth + auth middleware

**Files:**
- Create: `backend/src/auth/google.ts`
- Create: `backend/src/auth/middleware.ts`
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts` (mount auth routes, configure passport)
- Create: `backend/src/__tests__/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `config.google`, `session.user`
- Produces: `requireAuth` middleware; `requireJiraConnected` middleware; routes `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`

- [ ] **Step 1: Write failing test**

Create `backend/src/__tests__/auth.middleware.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /api/auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- --testPathPattern=auth.middleware
```
Expected: FAIL — routes not defined yet

- [ ] **Step 3: Create `backend/src/auth/google.ts`**

```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config';

passport.use(new GoogleStrategy(
  {
    clientID: config.google.clientId,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackUrl,
  },
  (_accessToken, _refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      email: profile.emails?.[0]?.value ?? '',
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));
```

- [ ] **Step 4: Create `backend/src/auth/middleware.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  next();
}

export function requireJiraConnected(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.jira) {
    res.status(403).json({ error: { code: 'JIRA_NOT_CONNECTED', message: 'Jira workspace not connected. Visit /api/jira/connect to link your account.' } });
    return;
  }
  next();
}
```

- [ ] **Step 5: Create `backend/src/routes/auth.ts`**

```typescript
import { Router } from 'express';
import passport from 'passport';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';

const router = Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/login?error=auth_failed` }),
  (req, res) => {
    // Passport puts the user on req.user; copy to session
    req.session.user = req.user as typeof req.session.user;
    res.redirect(config.frontendUrl + '/dashboard');
  }
);

router.get('/me', requireAuth, (req, res) => {
  res.json(req.session.user);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

export default router;
```

- [ ] **Step 6: Mount routes and Passport in `backend/src/app.ts`**

```typescript
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { config } from './config';
import './auth/google';  // registers Passport strategy
import './types/session';
import authRouter from './routes/auth';

export function createApp(): express.Application {
  const app = express();

  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);

  return app;
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && npm test -- --testPathPattern=auth.middleware
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/ backend/src/routes/auth.ts backend/src/app.ts backend/src/__tests__/auth.middleware.test.ts
git commit -m "feat: Google OAuth login, requireAuth middleware"
```

---

### Task 4: Jira OAuth (connect / disconnect / status)

**Files:**
- Create: `backend/src/routes/jiraAuth.ts`
- Modify: `backend/src/app.ts` (mount jiraAuth router)

**Interfaces:**
- Consumes: `config.jira`, `session.jira`
- Produces: routes `/api/jira/connect`, `/api/jira/callback`, `/api/jira/disconnect`, `/api/jira/status`

The Jira OAuth flow:
1. `/api/jira/connect` → redirect to Atlassian authorize URL
2. Atlassian → `/api/jira/callback?code=...`
3. Exchange code for tokens → `POST https://auth.atlassian.com/oauth/token`
4. Fetch accessible resources → `GET https://api.atlassian.com/oauth/token/accessible-resources`
5. Store `{ accessToken, refreshToken, cloudId, baseUrl }` in `req.session.jira`

- [ ] **Step 1: Create `backend/src/routes/jiraAuth.ts`**

```typescript
import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { requireAuth } from '../auth/middleware';

const router = Router();

// Store OAuth state in session to prevent CSRF
declare module 'express-session' {
  interface SessionData {
    jiraOAuthState?: string;
  }
}

router.get('/connect', requireAuth, (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.jiraOAuthState = state;

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.jira.clientId,
    scope: 'read:jira-work write:jira-work offline_access',
    redirect_uri: config.jira.callbackUrl,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  res.redirect(`https://auth.atlassian.com/authorize?${params}`);
});

router.get('/callback', requireAuth, async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (state !== req.session.jiraOAuthState) {
    res.status(400).json({ error: { code: 'INVALID_STATE', message: 'OAuth state mismatch' } });
    return;
  }
  delete req.session.jiraOAuthState;

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: config.jira.clientId,
      client_secret: config.jira.clientSecret,
      code,
      redirect_uri: config.jira.callbackUrl,
    });

    const { access_token: accessToken, refresh_token: refreshToken } = tokenRes.data;

    // Get the Jira cloud instance details
    const resourcesRes = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const site = resourcesRes.data[0]; // Use first accessible site
    if (!site) {
      res.status(400).json({ error: { code: 'NO_JIRA_SITE', message: 'No Jira sites found for this account' } });
      return;
    }

    req.session.jira = {
      accessToken,
      refreshToken,
      cloudId: site.id,
      baseUrl: site.url,
    };

    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (err) {
    console.error('Jira OAuth callback error:', err);
    res.redirect(`${config.frontendUrl}/dashboard?error=jira_auth_failed`);
  }
});

router.post('/disconnect', requireAuth, (req: Request, res: Response) => {
  delete req.session.jira;
  res.json({ ok: true });
});

router.get('/status', requireAuth, (req: Request, res: Response) => {
  if (!req.session.jira) {
    res.json({ connected: false });
    return;
  }
  res.json({ connected: true, baseUrl: req.session.jira.baseUrl });
});

export default router;
```

- [ ] **Step 2: Mount in `backend/src/app.ts`** — add after the authRouter line:

```typescript
import jiraAuthRouter from './routes/jiraAuth';
// ...
app.use('/api/jira', jiraAuthRouter);
```

- [ ] **Step 3: Manually test the status endpoint**

```bash
cd backend && npm run dev
curl http://localhost:3001/api/jira/status
```
Expected: `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}` (401, because not logged in — correct behaviour)

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/jiraAuth.ts backend/src/app.ts
git commit -m "feat: Jira OAuth connect/disconnect/status routes"
```

---

### Task 5: Jira clients + mappers

**Files:**
- Create: `backend/src/jira/mappers.ts`
- Create: `backend/src/jira/userClient.ts`
- Create: `backend/src/jira/serviceClient.ts`
- Create: `backend/src/__tests__/jira.mappers.test.ts`

**Interfaces:**
- Consumes: `FindingTicketPayload` from `@identityhub/shared`
- Produces: `JiraUserClient` class; `JiraServiceClient` class; `buildJiraIssueFields(payload)` function

- [ ] **Step 1: Write failing tests for mappers**

Create `backend/src/__tests__/jira.mappers.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern=jira.mappers
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `backend/src/jira/mappers.ts`**

```typescript
import { FindingTicketPayload, Severity } from '@identityhub/shared';

const SEVERITY_PRIORITY: Record<Severity, string> = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function toAdf(text: string) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern=jira.mappers
```
Expected: PASS (8 tests)

- [ ] **Step 5: Create `backend/src/jira/userClient.ts`**

```typescript
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
```

- [ ] **Step 6: Create `backend/src/jira/serviceClient.ts`**

```typescript
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
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/jira/ backend/src/__tests__/jira.mappers.test.ts
git commit -m "feat: Jira user/service clients and issue field mappers"
```

---

### Task 6: Jira feature routes (projects + findings + recent tickets)

**Files:**
- Create: `backend/src/routes/jira.ts`
- Modify: `backend/src/app.ts` (mount jira router — note: same `/api/jira` prefix, merge with jiraAuth router or mount separately)

**Interfaces:**
- Consumes: `JiraUserClient`, `requireAuth`, `requireJiraConnected`, `session.jira`
- Produces: `GET /api/jira/projects`, `POST /api/jira/findings`, `GET /api/jira/projects/:projectKey/recent-findings`

- [ ] **Step 1: Create `backend/src/routes/jira.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { requireAuth, requireJiraConnected } from '../auth/middleware';
import { JiraUserClient } from '../jira/userClient';
import { FindingTicketPayload } from '@identityhub/shared';

const router = Router();

function getJiraClient(req: Request): JiraUserClient {
  const { accessToken, cloudId, baseUrl } = req.session.jira!;
  return new JiraUserClient(accessToken, cloudId, baseUrl);
}

router.get('/projects', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  try {
    const projects = await getJiraClient(req).getProjects();
    res.json(projects);
  } catch (err) {
    console.error('Failed to fetch Jira projects:', err);
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: 'Failed to fetch projects from Jira' } });
  }
});

router.post('/findings', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  const { projectKey, title, description, severity, findingType, identityType } = req.body as FindingTicketPayload;

  if (!projectKey || !title || !description || !severity || !findingType || !identityType) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'All fields are required: projectKey, title, description, severity, findingType, identityType' } });
    return;
  }

  try {
    const result = await getJiraClient(req).createFinding({ projectKey, title, description, severity, findingType, identityType });
    res.status(201).json(result);
  } catch (err: any) {
    const jiraMessage = err?.response?.data?.errors
      ? Object.values(err.response.data.errors).join(', ')
      : 'Failed to create ticket in Jira';
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: jiraMessage } });
  }
});

router.get('/projects/:projectKey/recent-findings', requireAuth, requireJiraConnected, async (req: Request, res: Response) => {
  const { projectKey } = req.params;
  try {
    const tickets = await getJiraClient(req).getRecentFindings(projectKey);
    res.json(tickets);
  } catch (err) {
    console.error('Failed to fetch recent findings:', err);
    res.status(502).json({ error: { code: 'JIRA_ERROR', message: 'Failed to fetch recent tickets from Jira' } });
  }
});

export default router;
```

- [ ] **Step 2: Mount in `backend/src/app.ts`** — add after jiraAuthRouter:

```typescript
import jiraRouter from './routes/jira';
// ...
app.use('/api/jira', jiraRouter);
```

- [ ] **Step 3: Manually verify routes exist**

```bash
cd backend && npm run dev
curl -s http://localhost:3001/api/jira/projects
```
Expected: `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/jira.ts backend/src/app.ts
git commit -m "feat: Jira projects, create finding, and recent findings routes"
```

---

### Task 7: REST API endpoint (programmatic findings)

**Files:**
- Create: `backend/src/middleware/apiKey.ts`
- Create: `backend/src/routes/findings.ts`
- Modify: `backend/src/app.ts` (mount findings router)
- Create: `backend/src/__tests__/findings.api.test.ts`

**Interfaces:**
- Consumes: `config.apiKey`, `JiraServiceClient`, `config.jiraService`
- Produces: `POST /api/v1/findings` (API-key protected, uses service account)

- [ ] **Step 1: Write failing tests**

Create `backend/src/__tests__/findings.api.test.ts`:

```typescript
import request from 'supertest';
import { createApp } from '../app';

// Set required env vars before app loads
process.env.API_KEY = 'test-api-key-123';
process.env.JIRA_SERVICE_ACCOUNT_EMAIL = 'svc@example.com';
process.env.JIRA_SERVICE_ACCOUNT_TOKEN = 'token';
process.env.JIRA_SERVICE_BASE_URL = 'https://example.atlassian.net';

const app = createApp();

const validPayload = {
  projectKey: 'TEST',
  title: 'Stale Service Account: svc-deploy-prod',
  description: 'Last active 90 days ago, still has prod write access',
  severity: 'high',
  findingType: 'stale-credential',
  identityType: 'service-account',
};

describe('POST /api/v1/findings', () => {
  it('returns 401 when X-API-Key header is missing', async () => {
    const res = await request(app).post('/api/v1/findings').send(validPayload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-API-Key is wrong', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'wrong-key')
      .send(validPayload);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when severity is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, severity: 'very-bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('severity');
  });

  it('returns 400 when title is empty', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, title: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when findingType is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/findings')
      .set('X-API-Key', 'test-api-key-123')
      .send({ ...validPayload, findingType: 'unknown-type' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- --testPathPattern=findings.api
```
Expected: FAIL — routes not defined yet

- [ ] **Step 3: Create `backend/src/middleware/apiKey.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (!key || key !== config.apiKey) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } });
    return;
  }
  next();
}
```

- [ ] **Step 4: Create `backend/src/routes/findings.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { requireApiKey } from '../middleware/apiKey';
import { JiraServiceClient } from '../jira/serviceClient';
import { config } from '../config';
import { FindingTicketPayload, Severity, FindingType, IdentityType } from '@identityhub/shared';

const router = Router();

const VALID_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const VALID_FINDING_TYPES: FindingType[] = ['stale-credential', 'overprivileged', 'expiring-credential', 'misconfigured'];
const VALID_IDENTITY_TYPES: IdentityType[] = ['service-account', 'api-key', 'service-principal', 'oauth-app'];

function validate(body: Partial<FindingTicketPayload>): string | null {
  if (!body.title?.trim()) return 'title is required';
  if (!body.projectKey?.trim()) return 'projectKey is required';
  if (!body.description?.trim()) return 'description is required';
  if (!body.severity || !VALID_SEVERITIES.includes(body.severity)) {
    return `severity must be one of: ${VALID_SEVERITIES.join(', ')}`;
  }
  if (!body.findingType || !VALID_FINDING_TYPES.includes(body.findingType)) {
    return `findingType must be one of: ${VALID_FINDING_TYPES.join(', ')}`;
  }
  if (!body.identityType || !VALID_IDENTITY_TYPES.includes(body.identityType)) {
    return `identityType must be one of: ${VALID_IDENTITY_TYPES.join(', ')}`;
  }
  return null;
}

router.post('/', requireApiKey, async (req: Request, res: Response) => {
  const validationError = validate(req.body);
  if (validationError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validationError } });
    return;
  }

  const payload = req.body as FindingTicketPayload;
  const client = new JiraServiceClient(
    config.jiraService.email,
    config.jiraService.token,
    config.jiraService.baseUrl,
  );

  try {
    const result = await client.createFinding(payload);
    res.status(201).json(result);
  } catch (err: any) {
    const jiraMessage = err?.response?.data?.errors
      ? Object.values(err.response.data.errors).join(', ')
      : 'Failed to create ticket in Jira';
    const status = err?.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: { code: 'JIRA_ERROR', message: jiraMessage } });
  }
});

export default router;
```

- [ ] **Step 5: Mount in `backend/src/app.ts`** — add:

```typescript
import findingsRouter from './routes/findings';
// ...
app.use('/api/v1/findings', findingsRouter);
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npm test -- --testPathPattern=findings.api
```
Expected: PASS (5 tests)

- [ ] **Step 7: Run all backend tests**

```bash
cd backend && npm test
```
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add backend/src/middleware/ backend/src/routes/findings.ts backend/src/app.ts backend/src/__tests__/findings.api.test.ts
git commit -m "feat: REST API endpoint POST /api/v1/findings with API key auth and input validation"
```

---

### Task 8: Frontend scaffold

**Files:**
- Create: `frontend/` (Vite scaffold via CLI)
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: running Vite dev server; `apiFetch` utility consumed by all hooks

- [ ] **Step 1: Scaffold Vite + React + TypeScript**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend && npm install @tanstack/react-query react-router-dom sonner
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts
npx shadcn init
```

When shadcn asks:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 3: Update `frontend/vite.config.ts`** to proxy API calls to backend:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        credentials: true,
      },
    },
  },
});
```

- [ ] **Step 4: Update `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Create `frontend/src/api/client.ts`**

```typescript
import { ApiError } from '../../../shared/src/types';

export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    throw new ApiRequestError(
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? 'An unexpected error occurred',
      res.status,
    );
  }

  return data as T;
}
```

- [ ] **Step 6: Update `frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 7: Install shadcn components we'll need**

```bash
cd frontend && npx shadcn add button card input label select textarea badge
```

- [ ] **Step 8: Verify frontend starts**

```bash
cd frontend && npm run dev
```
Expected: Vite dev server on http://localhost:5173 (shows default Vite page for now)

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with Vite, React, Tailwind, shadcn, React Query"
```

---

### Task 9: Auth state + Login page

**Files:**
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/components/LoginPage.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/me`, `AppUser` from shared types
- Produces: `useAuth()` hook; `<LoginPage />` component; routing shell in `App.tsx`

- [ ] **Step 1: Create `frontend/src/hooks/useAuth.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiRequestError } from '../api/client';
import { AppUser } from '../../../shared/src/types';

export function useAuth() {
  const { data: user, isLoading } = useQuery<AppUser | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await apiFetch<AppUser>('/api/auth/me');
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  return { user: user ?? null, isLoading };
}
```

- [ ] **Step 2: Create `frontend/src/components/LoginPage.tsx`**

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">IdentityHub</CardTitle>
          <CardDescription>
            Report NHI findings directly to your Jira workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => { window.location.href = '/api/auth/google'; }}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';

// Dashboard imported in next task — placeholder for now
function DashboardPlaceholder() {
  return <div className="p-8">Dashboard — coming in next task</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPlaceholder />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify login page renders**

```bash
# Backend and frontend both running
curl http://localhost:5173/login  # should show HTML with "Sign in with Google"
```
Or open http://localhost:5173 in browser — should redirect to /login and show login card.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useAuth.ts frontend/src/components/LoginPage.tsx frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: login page and auth state hook"
```

---

### Task 10: Header + Jira connect/disconnect

**Files:**
- Create: `frontend/src/hooks/useJiraStatus.ts`
- Create: `frontend/src/components/Header.tsx`

**Interfaces:**
- Consumes: `GET /api/jira/status`, `POST /api/jira/disconnect`, `JiraStatus` from shared types
- Produces: `useJiraStatus()` hook; `<Header />` component

- [ ] **Step 1: Create `frontend/src/hooks/useJiraStatus.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { JiraStatus } from '../../../shared/src/types';

export function useJiraStatus() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<JiraStatus>({
    queryKey: ['jira', 'status'],
    queryFn: () => apiFetch<JiraStatus>('/api/jira/status'),
  });

  const disconnect = useMutation({
    mutationFn: () => apiFetch('/api/jira/disconnect', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
    },
  });

  return {
    status: status ?? { connected: false },
    isLoading,
    disconnect: disconnect.mutate,
    isDisconnecting: disconnect.isPending,
  };
}
```

- [ ] **Step 2: Create `frontend/src/components/Header.tsx`**

```tsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { apiFetch } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

export function Header() {
  const { user } = useAuth();
  const { status, disconnect, isDisconnecting } = useJiraStatus();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    queryClient.clear();
    window.location.href = '/login';
  };

  return (
    <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">IdentityHub</h1>
        <Badge variant="secondary">NHI Findings</Badge>
      </div>

      <div className="flex items-center gap-4">
        {status.connected ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span>{status.baseUrl?.replace('https://', '')}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect()}
              disabled={isDisconnecting}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = '/api/jira/connect'; }}
          >
            Connect Jira
          </Button>
        )}

        <div className="flex items-center gap-2 text-sm">
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
          )}
          <span className="text-slate-700">{user?.displayName}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useJiraStatus.ts frontend/src/components/Header.tsx
git commit -m "feat: header with Jira connect/disconnect and user info"
```

---

### Task 11: Create Finding Form + project dropdown

**Files:**
- Create: `frontend/src/hooks/useJiraProjects.ts`
- Create: `frontend/src/components/CreateFindingForm.tsx`

**Interfaces:**
- Consumes: `GET /api/jira/projects`, `POST /api/jira/findings`, `JiraProject`, `FindingTicketPayload`, `FindingTicketResult`
- Produces: `useJiraProjects()` hook; `<CreateFindingForm projectKey selectedProject onSuccess />` component

- [ ] **Step 1: Create `frontend/src/hooks/useJiraProjects.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { JiraProject } from '../../../shared/src/types';

export function useJiraProjects(enabled: boolean) {
  return useQuery<JiraProject[]>({
    queryKey: ['jira', 'projects'],
    queryFn: () => apiFetch<JiraProject[]>('/api/jira/projects'),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Create `frontend/src/components/CreateFindingForm.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiRequestError } from '../api/client';
import { FindingTicketPayload, FindingTicketResult, JiraProject } from '../../../shared/src/types';

interface Props {
  projects: JiraProject[];
  selectedProjectKey: string;
  onProjectChange: (key: string) => void;
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FINDING_TYPE_OPTIONS = [
  { value: 'stale-credential', label: 'Stale Credential' },
  { value: 'overprivileged', label: 'Overprivileged' },
  { value: 'expiring-credential', label: 'Expiring Credential' },
  { value: 'misconfigured', label: 'Misconfigured' },
];

const IDENTITY_TYPE_OPTIONS = [
  { value: 'service-account', label: 'Service Account' },
  { value: 'api-key', label: 'API Key' },
  { value: 'service-principal', label: 'Service Principal' },
  { value: 'oauth-app', label: 'OAuth App' },
];

export function CreateFindingForm({ projects, selectedProjectKey, onProjectChange }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'high' as FindingTicketPayload['severity'],
    findingType: 'stale-credential' as FindingTicketPayload['findingType'],
    identityType: 'service-account' as FindingTicketPayload['identityType'],
  });

  const { mutate: createFinding, isPending } = useMutation({
    mutationFn: (payload: FindingTicketPayload) =>
      apiFetch<FindingTicketResult>('/api/jira/findings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      toast.success(
        <span>
          Ticket <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">{result.key}</a> created
        </span>
      );
      setForm({ title: '', description: '', severity: 'high', findingType: 'stale-credential', identityType: 'service-account' });
      queryClient.invalidateQueries({ queryKey: ['jira', 'recent', selectedProjectKey] });
    },
    onError: (err) => {
      const msg = err instanceof ApiRequestError ? err.message : 'Failed to create ticket';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectKey) { toast.error('Select a Jira project first'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    createFinding({ projectKey: selectedProjectKey, ...form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create NHI Finding</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={selectedProjectKey} onValueChange={onProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name} ({p.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Stale Service Account: svc-deploy-prod"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Details about the finding..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as FindingTicketPayload['severity'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Finding Type</Label>
              <Select value={form.findingType} onValueChange={(v) => setForm((f) => ({ ...f, findingType: v as FindingTicketPayload['findingType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Identity Type</Label>
              <Select value={form.identityType} onValueChange={(v) => setForm((f) => ({ ...f, identityType: v as FindingTicketPayload['identityType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDENTITY_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !selectedProjectKey}>
            {isPending ? 'Creating...' : 'Create Finding Ticket'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useJiraProjects.ts frontend/src/components/CreateFindingForm.tsx
git commit -m "feat: Create Finding Form with project dropdown and all NHI fields"
```

---

### Task 12: Recent Tickets list

**Files:**
- Create: `frontend/src/hooks/useRecentTickets.ts`
- Create: `frontend/src/components/RecentTickets.tsx`

**Interfaces:**
- Consumes: `GET /api/jira/projects/:projectKey/recent-findings`, `RecentTicket`
- Produces: `useRecentTickets(projectKey)` hook; `<RecentTickets projectKey />` component

- [ ] **Step 1: Create `frontend/src/hooks/useRecentTickets.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { RecentTicket } from '../../../shared/src/types';

export function useRecentTickets(projectKey: string) {
  return useQuery<RecentTicket[]>({
    queryKey: ['jira', 'recent', projectKey],
    queryFn: () => apiFetch<RecentTicket[]>(`/api/jira/projects/${projectKey}/recent-findings`),
    enabled: !!projectKey,
    staleTime: 30 * 1000,
  });
}
```

- [ ] **Step 2: Create `frontend/src/components/RecentTickets.tsx`**

```tsx
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecentTickets } from '../hooks/useRecentTickets';

interface Props {
  projectKey: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentTickets({ projectKey }: Props) {
  const { data: tickets, isLoading, error } = useRecentTickets(projectKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent Findings
          <Badge variant="outline">{projectKey}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-slate-500">Loading tickets...</p>
        )}
        {error && (
          <p className="text-sm text-red-500">Failed to load recent tickets</p>
        )}
        {tickets && tickets.length === 0 && (
          <p className="text-sm text-slate-500">No findings created yet for this project</p>
        )}
        {tickets && tickets.length > 0 && (
          <ul className="divide-y">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="py-3 first:pt-0 last:pb-0">
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 group hover:text-blue-600"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{ticket.key}</span>
                      <span className="text-sm font-medium truncate group-hover:text-blue-600">
                        {ticket.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(ticket.createdAt)}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-blue-600 mt-0.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Install lucide-react**

```bash
cd frontend && npm install lucide-react
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useRecentTickets.ts frontend/src/components/RecentTickets.tsx
git commit -m "feat: recent tickets list with time-ago display and Jira links"
```

---

### Task 13: Dashboard wiring + README

**Files:**
- Create: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/App.tsx` (swap placeholder for Dashboard)
- Create: `README.md`

**Interfaces:**
- Consumes: `<Header />`, `<CreateFindingForm />`, `<RecentTickets />`, `useAuth`, `useJiraStatus`, `useJiraProjects`
- Produces: fully wired `/dashboard` page; `README.md` with setup instructions

- [ ] **Step 1: Create `frontend/src/components/Dashboard.tsx`**

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Header } from './Header';
import { CreateFindingForm } from './CreateFindingForm';
import { RecentTickets } from './RecentTickets';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { useJiraProjects } from '../hooks/useJiraProjects';

export function Dashboard() {
  const { status } = useJiraStatus();
  const { data: projects = [], isLoading: projectsLoading } = useJiraProjects(status.connected);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {!status.connected ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
            <p className="font-medium text-amber-800">Connect your Jira workspace to get started</p>
            <p className="text-sm text-amber-700">
              Link your Atlassian account to create and view NHI finding tickets.
            </p>
            <Button onClick={() => { window.location.href = '/api/jira/connect'; }}>
              Connect Jira
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CreateFindingForm
              projects={projects}
              selectedProjectKey={selectedProjectKey}
              onProjectChange={setSelectedProjectKey}
            />
            {selectedProjectKey ? (
              <RecentTickets projectKey={selectedProjectKey} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm p-8">
                Select a project to see recent findings
              </div>
            )}
          </div>
        )}
        {projectsLoading && status.connected && (
          <p className="text-center text-sm text-slate-400 mt-4">Loading projects...</p>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update `frontend/src/App.tsx`** — swap placeholder for Dashboard:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Create `README.md`**

```markdown
# IdentityHub Jira Integration

Report NHI findings directly to your Jira workspace from a web UI or CI/CD pipeline.

## Prerequisites

- Node.js ≥ 20
- A Google Cloud OAuth 2.0 app (for user login)
- An Atlassian OAuth 2.0 app (for Jira integration)
- A Jira service account + API token (for the REST API)

## Setup

### 1. Clone and install

git clone <repo>
cd identityhub-jira
npm run install:all

### 2. Configure credentials

cp .env.example .env

Fill in `.env`:

**Google OAuth** — https://console.cloud.google.com/apis/credentials
- Create an OAuth 2.0 Client ID (Web application)
- Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`

**Jira OAuth** — https://developer.atlassian.com/console/myapps/
- Create an OAuth 2.0 integration
- Add callback URL: `http://localhost:3001/api/jira/callback`
- Scopes: `read:jira-work`, `write:jira-work`, `offline_access`

**Jira Service Account** — for the REST API
- Create or use an existing Atlassian user as a service account
- Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens
- The service account must be a member of the Jira projects you intend to use
- Set `JIRA_SERVICE_BASE_URL` to your Jira site URL (e.g. `https://mycompany.atlassian.net`)

**API Key** — generate with:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

### 3. Run

npm run dev

Opens:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## REST API

Create a Finding Ticket programmatically:

curl -X POST http://localhost:3001/api/v1/findings \
  -H "X-API-Key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "OPS",
    "title": "Stale Service Account: svc-deploy-prod",
    "description": "Last active 90 days ago, still has prod write access",
    "severity": "high",
    "findingType": "stale-credential",
    "identityType": "service-account"
  }'

**Valid values:**
- `severity`: `critical` | `high` | `medium` | `low`
- `findingType`: `stale-credential` | `overprivileged` | `expiring-credential` | `misconfigured`
- `identityType`: `service-account` | `api-key` | `service-principal` | `oauth-app`

**Response (201):**
```json
{ "id": "10042", "key": "OPS-17", "url": "https://...", "createdAt": "2026-06-29T..." }
```

## Architecture decisions

See `docs/adr/` for recorded decisions. Key ones:
- [ADR-0001](docs/adr/0001-dual-jira-auth.md): Two Jira auth mechanisms — OAuth per user, Basic auth for the REST API service account
```

- [ ] **Step 4: Run full dev stack and manually test the golden path**

```bash
npm run dev
```

Checklist:
1. http://localhost:5173 → redirects to /login ✓
2. Click "Sign in with Google" → Google consent → lands on /dashboard ✓
3. Dashboard shows "Connect Jira" banner ✓
4. Click "Connect Jira" → Atlassian consent → back to dashboard, header shows connected site ✓
5. Project dropdown populates ✓
6. Select project → recent tickets panel appears ✓
7. Fill form + submit → toast with link to created ticket ✓
8. Recent tickets list updates to show new ticket ✓
9. Click a ticket → opens Jira in new tab ✓
10. "Disconnect" → status reverts to not connected ✓
11. "Sign out" → redirects to /login ✓

- [ ] **Step 5: Test the REST API**

```bash
curl -X POST http://localhost:3001/api/v1/findings \
  -H "X-API-Key: $(grep API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"projectKey":"OPS","title":"Test Finding","description":"Test","severity":"high","findingType":"stale-credential","identityType":"api-key"}'
```
Expected: `{"id":"...","key":"OPS-XX","url":"...","createdAt":"..."}`

- [ ] **Step 6: Run all backend tests one final time**

```bash
cd backend && npm test
```
Expected: PASS (all tests)

- [ ] **Step 7: Final commit**

```bash
git add frontend/src/components/Dashboard.tsx frontend/src/App.tsx README.md
git commit -m "feat: wire Dashboard, complete golden path, add README"
```

---

## Self-review

**Spec coverage check:**

| Requirement | Covered in |
|---|---|
| User login + logout | Task 3 (Google OAuth), Task 10 (logout in Header) |
| Secure session management | Task 2 (express-session, httpOnly cookies) |
| Multiple concurrent users without data interference | Task 2 (per-session Jira tokens), Task 4 (Jira tokens in session scope) |
| Jira integration after login | Task 4 (Jira OAuth connect/disconnect) |
| Create NHI finding ticket (UI) | Task 11 (CreateFindingForm) |
| Project selector from connected workspace | Task 11 (dropdown from GET /api/jira/projects) |
| Title + description + extra NHI fields | Task 11 (severity, findingType, identityType) |
| Recent 10 tickets from this app | Task 12 (identityhub label + JQL maxResults=10) |
| Ticket title + creation time | Task 12 (RecentTickets shows title + timeAgo) |
| Clickable tickets opening Jira in new tab | Task 12 (target="_blank" links) |
| REST API POST endpoint | Task 7 |
| REST API key auth | Task 7 (requireApiKey middleware) |
| REST API status codes + error messages | Task 7 (validation + JIRA_ERROR responses) |
| REST API input validation | Task 7 (validate() function, enum checks) |

**No placeholders found.**

**Type consistency:** All types flow from `shared/src/types.ts`. `FindingTicketPayload`, `FindingTicketResult`, `JiraProject`, `RecentTicket`, `AppUser`, `JiraStatus` are used consistently across tasks 5–12.
