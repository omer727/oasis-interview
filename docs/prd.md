# PRD: IdentityHub Jira Integration

## Problem Statement

Security and platform engineers using IdentityHub discover NHI Findings — stale service accounts, overprivileged API keys, expiring credentials, misconfigured identities — on a regular basis. Today, reporting these findings to their team requires leaving the product, opening Jira, manually filling out a ticket, and copying context across. There is no structured way for automated scanners or CI/CD pipelines to report findings programmatically. This friction means findings go unreported, lose context in translation, or pile up without a trackable remediation workflow.

## Solution

A web application that lets App Users connect their Jira workspace via OAuth 2.0 and create structured Finding Tickets directly from a form. Findings are tagged with severity, finding type, and identity type so they land in Jira pre-categorised and filterable. The app also exposes a REST API endpoint so scanners and CI/CD pipelines can create Finding Tickets programmatically using an API Key, without a browser session.

## User Stories

1. As an App User, I want to sign in with my Google account, so that I can access IdentityHub without managing a separate password.
2. As an App User, I want to sign out of IdentityHub, so that my session is cleared when I'm done.
3. As an App User, I want my session to be isolated from other users, so that I cannot see or interfere with another user's Jira Connection or Finding Tickets.
4. As an App User, I want to connect my Jira workspace via OAuth 2.0, so that Finding Tickets are created under my own Jira identity without sharing my credentials.
5. As an App User, I want to see which Jira workspace I have connected, so that I know which site my findings will be sent to.
6. As an App User, I want to disconnect my Jira workspace, so that I can revoke the integration or switch to a different Atlassian account.
7. As an App User, I want the create-ticket form to be disabled until I connect a Jira workspace, so that I receive clear guidance rather than a confusing error on submit.
8. As an App User, I want to select a Jira project from a dropdown populated from my connected workspace, so that I don't need to remember or type project keys manually.
9. As an App User, I want to provide a title for a Finding Ticket, so that the Jira issue has a descriptive summary (e.g. "Stale Service Account: svc-deploy-prod").
10. As an App User, I want to write a description for a Finding Ticket, so that I can include details about what was found and why it matters.
11. As an App User, I want to set a severity level (Critical, High, Medium, Low) for a Finding Ticket, so that the Jira issue is automatically prioritised for triage.
12. As an App User, I want to classify the finding type (Stale Credential, Overprivileged, Expiring Credential, Misconfigured), so that findings are categorised consistently across the team.
13. As an App User, I want to specify the identity type (Service Account, API Key, Service Principal, OAuth App), so that engineers can filter tickets by the kind of identity affected.
14. As an App User, I want to see a success notification with a link to the created Jira ticket immediately after submission, so that I can confirm the ticket was created and navigate to it in one click.
15. As an App User, I want to see a clear, human-readable error message if ticket creation fails, so that I know whether to retry or contact an admin.
16. As an App User, I want to see the 10 most recent Finding Tickets for the selected project, so that I can avoid creating duplicates and track recent activity.
17. As an App User, I want each recent Finding Ticket to show its title and how long ago it was created, so that I can quickly assess recency without opening Jira.
18. As an App User, I want to click a recent Finding Ticket to open it in Jira in a new tab, so that I can view full details without leaving the app.
19. As an App User, I want the recent tickets list to refresh automatically after I create a new Finding Ticket, so that my new ticket appears immediately.
20. As a CI/CD pipeline or scanner, I want to create a Finding Ticket via a REST API endpoint, so that findings can be reported programmatically without a browser session.
21. As a CI/CD pipeline or scanner, I want to authenticate with an API Key passed in a request header, so that the integration is simple to configure in any pipeline tool.
22. As a CI/CD pipeline or scanner, I want to receive a structured error response with a machine-readable code and human-readable message when my request is invalid, so that I can surface the failure clearly in pipeline logs.
23. As a CI/CD pipeline or scanner, I want the API to reject requests with an invalid or missing API Key with a 401 status, so that unauthorised callers are clearly blocked.
24. As a CI/CD pipeline or scanner, I want the API to validate all input fields and return a 400 with a specific message on failure, so that I can fix my request without guessing what went wrong.
25. As a CI/CD pipeline or scanner, I want the API to return a 201 with the created ticket's key, URL, and creation timestamp on success, so that I can log or link the result downstream.

## Implementation Decisions

### Authentication architecture — two layers

There are two separate authentication layers that must not be confused:

- **App authentication**: App Users sign in via Google OAuth 2.0. A session is created server-side (express-session, in-memory store) and identified by an httpOnly session cookie. The session holds the App User's identity (Google ID, email, display name).
- **Jira Connection**: After app sign-in, each App User separately connects their Jira workspace via Atlassian OAuth 2.0 (3LO). The resulting access and refresh tokens are stored inside the user's session, never in a database or exposed to the browser.

These are distinct: an App User can be authenticated into IdentityHub but not have a Jira Connection.

### Dual Jira clients

Two independent Jira API clients exist (see ADR-0001):

- **User client**: Uses the App User's Jira OAuth access token. Calls `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/`. Used by all UI-driven routes.
- **Service client**: Uses a shared service account (email + API token) from environment variables. Uses HTTP Basic auth against `https://{JIRA_SERVICE_BASE_URL}/rest/api/3/`. Used exclusively by the REST API endpoint.

### Session management

Sessions are stored in Express's in-memory store (see ADR-0003). No Redis or database is required. Sessions expire after 24 hours. Jira OAuth tokens are stored inside the session object and are never returned to the browser.

### Finding Ticket field mapping

All Finding Ticket fields map to standard Jira fields — no custom fields required (see ADR-0006):

- `severity` → Jira `priority`: Critical→Highest, High→High, Medium→Medium, Low→Low
- `findingType` → label: `type:stale-credential`, `type:overprivileged`, `type:expiring-credential`, `type:misconfigured`
- `identityType` → label: `identity:service-account`, `identity:api-key`, `identity:service-principal`, `identity:oauth-app`
- All Finding Tickets also receive the `identityhub` label for app-scoped querying

Jira's `description` field uses Atlassian Document Format (ADF), not plain text. The user's description string is wrapped in an ADF paragraph node before submission.

### Recent tickets query

The recent tickets view uses Jira's search API with JQL rather than a local ticket log (see ADR-0004):

```
project = "X" AND labels = "identityhub" ORDER BY created DESC
```

With `maxResults=10`. No local database is needed — Jira is the source of truth.

### REST API contract

```
POST /api/v1/findings
X-API-Key: <key>
Content-Type: application/json

{
  "projectKey": "OPS",
  "title": "Stale Service Account: svc-deploy-prod",
  "description": "Last active 90 days ago, still has prod write access",
  "severity": "high",
  "findingType": "stale-credential",
  "identityType": "service-account"
}
```

Success `201`:
```json
{ "id": "10042", "key": "OPS-17", "url": "https://...atlassian.net/browse/OPS-17", "createdAt": "2026-06-29T10:00:00Z" }
```

Error shape (all error responses):
```json
{ "error": { "code": "SCREAMING_SNAKE_CASE", "message": "human-readable string" } }
```

Error codes: `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400), `JIRA_ERROR` (502), `JIRA_NOT_CONNECTED` (403).

### API Key

A single shared secret loaded from the `API_KEY` environment variable (see ADR-0005). No per-integration keys, no key management UI. Validated by middleware on the `POST /api/v1/findings` route only.

### Shared types

Frontend and backend share TypeScript interfaces via a `shared/` package: `FindingTicketPayload`, `FindingTicketResult`, `JiraProject`, `RecentTicket`, `AppUser`, `JiraStatus`, `ApiError`.

### Frontend

- React 18, Vite, Tailwind CSS, shadcn/ui components
- React Query (`@tanstack/react-query`) for all server state
- Vite dev-server proxy forwards `/api` requests to the Express backend
- `sonner` for toast notifications (success and error)
- Two routes: `/login` and `/dashboard` (protected)
- Dashboard layout: header (user info + connect/disconnect) + two-column main (create form + recent tickets)

## Testing Decisions

**What makes a good test here:** test external behaviour at the highest meaningful seam — HTTP responses, not internal functions. A test should break if a user-visible contract changes and pass regardless of how the internals are restructured.

**Backend — HTTP route level (supertest)**

Tests send real HTTP requests to the Express app and assert on status codes and response bodies. Jira API calls are mocked (jest.mock on axios) so no live Jira connection is required. This is the preferred seam because it exercises middleware, routing, and response shaping in one shot.

Modules tested at this seam:
- `requireAuth` middleware: unauthenticated requests return `401 UNAUTHORIZED`
- `requireApiKey` middleware: missing/wrong key returns `401 UNAUTHORIZED`, correct key passes through
- `POST /api/v1/findings` validation: invalid enum values, empty required fields return `400 VALIDATION_ERROR` with a message naming the invalid field

**Pure function level — mapper**

`buildJiraIssueFields()` maps a `FindingTicketPayload` to a Jira `fields` object. Tested directly as a unit because it encodes the severity→priority and label-prefix logic that is easy to misconfigure and has no I/O side effects.

Tests cover: all four severity mappings, presence of `identityhub` label, `type:` and `identity:` label prefixes, ADF wrapping of description.

**Frontend — not unit tested**

Frontend component tests are out of scope for this PoC. The golden-path manual checklist in the implementation plan covers the UI.

## Out of Scope

- Multiple API keys per deployment, key rotation UI, or per-integration audit logs
- Jira token refresh (access tokens expire; users re-connect when needed)
- Assigning Finding Tickets to Jira users
- Due dates, sprint assignment, or any other Jira field beyond what is mapped
- Custom Jira fields (all fields map to standard Jira primitives)
- Supporting more than one connected Jira site per App User at a time
- End-to-end or frontend unit tests
- Production deployment configuration (Docker, CI/CD pipeline for the app itself)
- Any IdentityHub features beyond Finding Ticket creation

## Further Notes

- The `identityhub` Jira label is a soft contract. If a user manually removes it from a ticket in Jira, that ticket will no longer appear in the recent tickets view. If another team uses the same label in the same project for unrelated tickets, those tickets will appear. Both are acceptable edge cases for a PoC.
- The service account used by the REST API must be a member of every Jira project callers intend to target. This is a deployment concern documented in the README.
- All architectural decisions referenced here have corresponding ADRs in `docs/adr/`.
