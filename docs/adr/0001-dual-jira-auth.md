# Dual Jira authentication: OAuth per user, API token for programmatic access

The app has two paths to Jira: interactive users authenticate via OAuth 2.0 (3LO) so their actions appear under their own Jira identity. The programmatic REST API uses a shared service account (email + API token in `.env`) because it is invoked by CI/CD pipelines that have no user session to delegate. This means the codebase has two Jira clients — one that exchanges a user's OAuth access token, one that uses HTTP Basic auth with the service account credentials. A future reader might wonder why both exist; the answer is that the OAuth path cannot be used without a browser redirect, making it unsuitable for headless callers.

## Consequences

The service account must be a member of every Jira project callers intend to target. This is a deployment concern, not a code concern — document it in the README.
