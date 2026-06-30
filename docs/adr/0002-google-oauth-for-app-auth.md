# Google OAuth for app-level authentication

Users log into IdentityHub via Google OAuth rather than a username/password form. The alternatives were a local credential store (simpler, self-contained) or no app auth at all. Google OAuth was chosen because the assessment criteria explicitly include security practices and multi-tenancy — owning a local password store adds bcrypt, registration flows, and credential storage concerns that distract from the core Jira integration. Google OAuth delegates credential management to a trusted provider and produces a clean user identity (Google ID + email) that scopes each session without any local user table.

The tradeoff is setup friction: the reviewer must configure a Google OAuth app and supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. This is mitigated by a clear README section with step-by-step instructions.

## Considered options

- **Username/password**: simpler to run offline, but adds bcrypt, registration, and a local user store — complexity that contributes nothing to what the PoC is demonstrating.
- **No app auth**: ruled out because the brief explicitly requires login/logout and concurrent-user isolation.
- **Jira OAuth as app login** (one OAuth flow covering both app auth and Jira connection): attractive because it reduces setup to one OAuth app. Ruled out because it makes Jira disconnect impossible without logging out of the app entirely — and the brief's phrasing "ability to integrate with Jira *after* logon" implies two distinct steps.
- **Env-var credentials** (`APP_USERNAME` + `APP_PASSWORD` in `.env`): zero external dependencies, no OAuth app to register. Ruled out because it breaks the concurrent-user isolation requirement — all sessions share the same identity and cannot be told apart.
