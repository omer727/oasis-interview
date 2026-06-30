# Issues

---

## Issue 1: Monorepo scaffold + shared types

### What to build

Set up the monorepo structure with `frontend/`, `backend/`, and `shared/` directories. Wire a root `package.json` with a single `npm run dev` command that starts both servers concurrently. Define all shared TypeScript interfaces used across frontend and backend in `shared/src/types.ts`. Create `.env.example` with all required environment variable keys documented.

No user-visible behaviour — this is the foundation every other slice depends on.

### Acceptance criteria

- [ ] `npm run install:all` installs all workspace dependencies in one command
- [ ] `npm run dev` starts both the Express backend (port 3001) and Vite frontend (port 5173) concurrently
- [ ] `shared/src/types.ts` exports: `FindingTicketPayload`, `FindingTicketResult`, `JiraProject`, `RecentTicket`, `AppUser`, `JiraStatus`, `ApiError`, `Severity`, `FindingType`, `IdentityType`
- [ ] `.env.example` documents all required env vars with comments explaining where to obtain each value
- [ ] TypeScript strict mode enabled on both `backend/tsconfig.json` and `frontend/tsconfig.json`
- [ ] `.gitignore` excludes `node_modules/`, `dist/`, and `.env`

### Blocked by

None — can start immediately.

---

## Issue 2: App authentication (login / logout)

### What to build

End-to-end slice: an App User visits the app, clicks "Sign in with Google", completes the Google OAuth 2.0 flow, lands on a protected `/dashboard` route, and can sign out. Unauthenticated requests to protected routes return `401`. Multiple concurrent users receive independent sessions with no data leakage between them.

Includes:
- Express session middleware (in-memory store, httpOnly cookie)
- Passport.js Google OAuth 2.0 strategy
- `requireAuth` middleware
- `/login` page (Google sign-in button)
- `/dashboard` placeholder (just enough to confirm the protected route works)
- Logout endpoint that destroys the session and clears the cookie

### Acceptance criteria

- [ ] Visiting `/` redirects unauthenticated users to `/login`
- [ ] Clicking "Sign in with Google" initiates the Google OAuth flow
- [ ] Successful OAuth redirects to `/dashboard` with the App User's session established
- [ ] `GET /api/auth/me` returns the App User's `id`, `email`, `displayName`, and `avatarUrl` when authenticated
- [ ] `GET /api/auth/me` returns `401 { error: { code: "UNAUTHORIZED", message: "Authentication required" } }` when not authenticated
- [ ] `POST /api/auth/logout` destroys the session and clears the session cookie
- [ ] Two independent sessions cannot access each other's data
- [ ] `requireAuth` middleware test passes: unauthenticated request → 401

### Blocked by

Issue 1

---

## Issue 3: Jira workspace connection

### What to build

End-to-end slice: an authenticated App User connects their Jira workspace via Atlassian OAuth 2.0 (3LO), sees the connected site URL in the header, and can disconnect. The Jira OAuth access and refresh tokens are stored inside the user's session — never returned to the browser. The create-ticket form area shows a clear "Connect Jira" prompt until a Jira Connection exists.

Includes:
- Atlassian OAuth 2.0 authorize/callback routes
- CSRF state parameter validation
- Accessible-resources call to resolve `cloudId` and `baseUrl`
- Session storage of Jira tokens (`accessToken`, `refreshToken`, `cloudId`, `baseUrl`)
- `requireJiraConnected` middleware
- `GET /api/jira/status` returning `{ connected: boolean, baseUrl?: string }`
- `POST /api/jira/disconnect` clearing Jira tokens from session
- Header component showing connected site + Disconnect button, or Connect Jira button

### Acceptance criteria

- [ ] Unauthenticated users cannot initiate the Jira OAuth flow (`/api/jira/connect` returns 401)
- [ ] Clicking "Connect Jira" redirects to Atlassian's authorization page
- [ ] After Atlassian consent, the user is redirected back to `/dashboard` with Jira connected
- [ ] `GET /api/jira/status` returns `{ connected: true, baseUrl: "https://..." }` after connection
- [ ] `GET /api/jira/status` returns `{ connected: false }` before connection or after disconnect
- [ ] Header shows the connected Jira site URL and a Disconnect button when connected
- [ ] Clicking Disconnect clears the Jira tokens and reverts the header to "Connect Jira"
- [ ] A disconnected App User sees a clear prompt to connect Jira; the create form is disabled
- [ ] Jira tokens from User A's session are not accessible to User B's session
- [ ] Invalid OAuth state parameter returns `400 INVALID_STATE`

### Blocked by

Issue 2

---

## Issue 4: Create Finding Ticket (UI)

### What to build

End-to-end slice: an App User with a Jira Connection selects a project from a dropdown, fills out the NHI Finding form, submits it, and sees a success toast with a link to the created Jira ticket. The ticket appears in Jira with the correct priority, labels, and ADF-formatted description.

Includes:
- `GET /api/jira/projects` returning the user's accessible Jira projects
- `POST /api/jira/findings` creating a Jira issue via the user's OAuth token
- Jira issue field mapper: `severity` → Jira `priority`, `findingType` → `type:` label, `identityType` → `identity:` label, `identityhub` label always present, description wrapped in ADF
- `JiraUserClient` class (OAuth Bearer, `api.atlassian.com` base URL)
- Project dropdown populated from the Jira API (shows `Name (KEY)`)
- Form fields: title, description, severity, finding type, identity type
- Success toast with clickable link to the created ticket
- Clear, specific error toast if creation fails (surfaces Jira's error message)
- Form resets after successful submission

The field mapping (from a prototype, decision-rich part only):

```
severity → priority:  critical→Highest, high→High, medium→Medium, low→Low
findingType → label:  "type:{findingType}"   (e.g. type:stale-credential)
identityType → label: "identity:{identityType}" (e.g. identity:service-account)
always:               "identityhub"
description:          wrapped in ADF { type:"doc", version:1, content:[{type:"paragraph",...}] }
```

### Acceptance criteria

- [ ] Project dropdown lists all Jira projects accessible to the connected App User
- [ ] Form requires all fields; submit is disabled until a project is selected
- [ ] Submitting the form creates a Jira issue with `summary` = title, `priority` mapped from severity, and labels `identityhub`, `type:<findingType>`, `identity:<identityType>`
- [ ] Created ticket's description is readable in Jira (ADF format, not `[object Object]`)
- [ ] Success toast appears with the ticket key (e.g. `OPS-17`) as a clickable link
- [ ] Clicking the toast link opens the Jira ticket in a new tab
- [ ] Form resets to defaults after successful submission
- [ ] If Jira returns an error, a specific error message is shown (not a generic "something went wrong")
- [ ] `buildJiraIssueFields` unit tests pass: all four severity mappings, label prefixes, ADF wrapping
- [ ] `GET /api/jira/projects` returns 403 `JIRA_NOT_CONNECTED` if no Jira Connection exists

### Blocked by

Issue 3

---

## Issue 5: Recent Finding Tickets view

### What to build

End-to-end slice: when an App User selects a Jira project, the 10 most recent Finding Tickets for that project are displayed alongside the create form. Each ticket shows its title and how long ago it was created. Clicking a ticket opens it in Jira in a new tab. After a new Finding Ticket is created, the list refreshes automatically to include it.

Includes:
- `GET /api/jira/projects/:projectKey/recent-findings` querying Jira with JQL `project = "X" AND labels = "identityhub" ORDER BY created DESC` and `maxResults=10`
- `RecentTickets` component with time-ago display and external link icon
- Auto-invalidation of the recent tickets query on successful form submission
- Empty state ("No findings created yet for this project")
- Error state ("Failed to load recent tickets")
- Placeholder panel when no project is selected ("Select a project to see recent findings")

### Acceptance criteria

- [ ] Selecting a project triggers a fetch of recent Finding Tickets for that project
- [ ] Up to 10 tickets are displayed; each shows title and relative creation time (e.g. "2h ago", "3d ago")
- [ ] Clicking a ticket opens `https://...atlassian.net/browse/<KEY>` in a new tab
- [ ] Creating a new Finding Ticket causes the list to refresh within the same page interaction
- [ ] If no Finding Tickets exist for the project, an empty state message is shown
- [ ] If the Jira API call fails, an error message is shown (not a blank panel)
- [ ] No project selected → placeholder panel is shown instead of the tickets list
- [ ] Only tickets tagged `identityhub` appear (tickets created outside this app are excluded)

### Blocked by

Issue 4

---

## Issue 6: Programmatic REST API

### What to build

End-to-end slice: an external system (CI/CD pipeline, scanner) sends `POST /api/v1/findings` with an `X-API-Key` header and a JSON body describing an NHI Finding. The endpoint validates the key and all input fields, creates a Finding Ticket in Jira via a shared service account (not a user's OAuth token), and returns `201` with the created ticket's key, URL, and timestamp. Invalid requests receive structured error responses with machine-readable codes.

Includes:
- `requireApiKey` middleware validating `X-API-Key` against the `API_KEY` env var
- `JiraServiceClient` class (HTTP Basic auth with service account credentials, direct Jira URL)
- Input validation for all enum fields (`severity`, `findingType`, `identityType`) and required string fields
- `POST /api/v1/findings` route
- Tests: missing key → 401, wrong key → 401, invalid severity → 400 with message naming the field, empty title → 400, valid request with mocked Jira → 201

### Acceptance criteria

- [ ] Request without `X-API-Key` header returns `401 { error: { code: "UNAUTHORIZED", ... } }`
- [ ] Request with wrong `X-API-Key` value returns `401`
- [ ] Request with correct key but invalid `severity` value returns `400 { error: { code: "VALIDATION_ERROR", message: "severity must be one of: critical, high, medium, low" } }`
- [ ] Request with empty `title` returns `400 VALIDATION_ERROR`
- [ ] Request with invalid `findingType` or `identityType` returns `400 VALIDATION_ERROR` naming the field
- [ ] Valid request creates a Jira issue via the service account and returns `201 { id, key, url, createdAt }`
- [ ] The created ticket carries the same labels and priority mapping as UI-created tickets
- [ ] The service account's Jira identity (not any App User's) is shown as the ticket creator in Jira
- [ ] All five test cases pass without a live Jira connection (Jira client mocked)

### Blocked by

Issue 4
