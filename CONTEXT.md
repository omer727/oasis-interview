# IdentityHub Jira Integration

A proof-of-concept integration that lets IdentityHub users report NHI findings directly to their Jira workspace.

## Language

**NHI Finding**: A discovered issue with a non-human identity — e.g., a stale service account, overprivileged API key, or expiring credential.
_Avoid_: issue, problem, alert, incident

**App User**: A person authenticated into IdentityHub via Google OAuth. The app's own identity layer, distinct from their Jira Connection.
_Avoid_: user, account, member

**Jira Connection**: A user's linked Jira workspace, established via OAuth 2.0 (Atlassian 3LO). Scoped per user — each user's Jira calls execute under their own identity.
_Avoid_: Jira integration, Jira account

**Finding Ticket**: A Jira issue created through this application to track an NHI Finding. Always tagged with the `identityhub` Jira label plus `type:<finding-type>` and `identity:<identity-type>` labels for filtering.
_Avoid_: ticket, issue, report

**API Key**: A shared secret loaded from environment variables, used to authenticate programmatic access to the REST API. A single key per deployment.
_Avoid_: token, credential, secret
