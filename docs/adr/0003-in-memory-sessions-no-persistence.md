# In-memory sessions with no persistence layer

Sessions are stored in Express's default in-memory store. No Redis, SQLite, or other external store is used. This means all sessions — including the Jira OAuth tokens stored inside them — are lost on server restart.

This was chosen because the brief asks for "the easiest, most frictionless way possible" to run the app. Adding Redis or a session database introduces a second service the reviewer must start and configure. The Jira OAuth tokens are sensitive and must never reach the browser; the session is the right container for them regardless of persistence strategy. For a PoC, re-connecting Jira after a restart is an acceptable limitation.

## Consequences

- Server restarts require users to re-authenticate with Google and reconnect Jira.
- In-memory sessions do not survive horizontal scaling. A production deployment would replace the in-memory store with a Redis-backed store (`connect-redis`) with no other code changes.
