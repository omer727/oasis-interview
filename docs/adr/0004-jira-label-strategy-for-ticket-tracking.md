# Jira label strategy for tracking app-created tickets

The "recent tickets" view must show only tickets created through this app. Rather than maintaining a local log of created issue keys, every Finding Ticket is tagged with the label `identityhub` at creation time. The recent-tickets query uses JQL: `project = "X" AND labels = "identityhub" ORDER BY created DESC` with `maxResults=10`.

This was chosen over a local ticket log because it eliminates the only reason to introduce a persistence layer. The data lives in Jira — the authoritative source — and survives server restarts, multiple instances, and any future migration. The JQL approach also means tickets created through the app are naturally discoverable in Jira's own search and filter views, which is a better user experience than a private app-side list.

## Considered options

- **Local ticket log (SQLite)**: would require a database, complicates setup, and creates a second source of truth that can drift from Jira.

## Consequences

- A user who manually removes the `identityhub` label from a ticket in Jira will cause it to disappear from the recent-tickets view. This is an acceptable edge case for a PoC.
- The `identityhub` label is a soft contract — if someone else uses the same label in the same Jira project for unrelated tickets, those tickets will appear in the view. Namespacing the label further (e.g. `identityhub-finding`) is a straightforward change if needed.
