# IdentityHub Jira Integration

Report NHI findings directly to your Jira workspace from a web UI or CI/CD pipeline.

## Prerequisites

- Node.js ≥ 20
- A Google Cloud OAuth 2.0 app (for user login)
- An Atlassian OAuth 2.0 app (for Jira integration)
- A Jira service account + API token (for the REST API)

## Setup

### 1. Clone and install

```bash
npm run install:all
```

### 2. Configure credentials

**If you received a `.env` file by email**, place it in the project root (next to `package.json`) and skip to step 3. All credentials are pre-configured.

**Otherwise**, create one from the template:

```bash
cp .env.example .env
```

Fill in `.env`:

**Google OAuth** — https://console.cloud.google.com/apis/credentials
- Create an OAuth 2.0 Client ID (Web application)
- Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
- Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env`

**Jira OAuth** — https://developer.atlassian.com/console/myapps/
- Create an OAuth 2.0 (3LO) integration
- Add callback URL: `http://localhost:3001/api/jira/callback`
- Scopes: `read:jira-work`, `write:jira-work`, `offline_access`
- Under **Distribution**, set to **Sharing** (the default Development mode only allows the app owner to authorise — any other Atlassian account will be blocked)
- Copy `JIRA_CLIENT_ID` and `JIRA_CLIENT_SECRET` into `.env`

**Jira Service Account** — for the REST API
- Create or use an existing Atlassian user as a service account
- Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens
- The service account must be a member of the Jira projects you intend to use
- Set `JIRA_SERVICE_BASE_URL` to your Jira site URL (e.g. `https://mycompany.atlassian.net`)

**API Key** — generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Session Secret** — generate with the same command, use a different value.

### 3. Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Usage

1. Visit http://localhost:5173 → redirects to `/login`
2. Click **Sign in with Google** → completes Google OAuth
3. Click **Connect Jira** → completes Atlassian OAuth
4. Select a project from the dropdown
5. Fill in the NHI finding form and submit
6. See the created ticket appear in Recent Findings

## REST API

Create a Finding Ticket programmatically (no browser required):

```bash
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
```

**Valid values:**
- `severity`: `critical` | `high` | `medium` | `low`
- `findingType`: `stale-credential` | `overprivileged` | `expiring-credential` | `misconfigured`
- `identityType`: `service-account` | `api-key` | `service-principal` | `oauth-app`

**Response (201):**
```json
{ "id": "10042", "key": "OPS-17", "url": "https://...atlassian.net/browse/OPS-17", "createdAt": "2026-06-29T10:00:00Z" }
```

**Error shape (all errors):**
```json
{ "error": { "code": "SCREAMING_SNAKE_CASE", "message": "human-readable string" } }
```

## Architecture decisions

See `docs/adr/` for recorded decisions:

- [ADR-0001](docs/adr/0001-dual-jira-auth.md): Two Jira auth mechanisms — OAuth per user, Basic auth for REST API
- [ADR-0002](docs/adr/0002-google-oauth-for-app-auth.md): Google OAuth for app-level authentication
- [ADR-0003](docs/adr/0003-in-memory-sessions-no-persistence.md): In-memory session store
- [ADR-0004](docs/adr/0004-jira-label-strategy-for-ticket-tracking.md): Jira label strategy for ticket tracking
- [ADR-0005](docs/adr/0005-single-env-var-api-key.md): Single shared API key
- [ADR-0006](docs/adr/0006-standard-jira-fields-only.md): Standard Jira fields only
- [ADR-0007](docs/adr/0007-ux-decisions-dashboard.md): UX decisions — dashboard interactions and visual polish

## Tests

```bash
cd backend && npm test
```

14 tests covering:
- `requireAuth` middleware: unauthenticated → 401
- `requireApiKey` middleware: missing/wrong key → 401
- `POST /api/v1/findings` validation: invalid enum, empty title → 400
- `buildJiraIssueFields` mapper: all severity mappings, label prefixes, ADF wrapping
