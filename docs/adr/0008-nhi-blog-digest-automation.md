# NHI Blog Digest: automation design decisions

The bonus feature fetches the latest post from `oasis.security/blog` every 4 hours, generates an AI summary, and creates a Jira ticket — unless a ticket for that post already exists.

## Separate code path from Finding Tickets

Blog digest tickets are not NHI Findings. The existing `createFinding` path mandates `severity`, `findingType`, and `identityType` — fields that have no meaning for a blog post. Rather than bolting digest creation onto `FindingTicketPayload` with dummy values (which would corrupt the `type:` and `identity:` labels and contradict the domain model), two new methods — `ticketExistsForLabel` and `createDigestTicket` — were added directly to the existing `JiraServiceClient`. This reuses the authenticated HTTP client without duplicating the auth setup, and keeps the digest as a separate concern within the same class.

## Label-based deduplication over local state

To avoid creating a duplicate ticket when the latest post hasn't changed, the job searches Jira for a ticket carrying the label `blog-digest:<slug>` before doing anything else. If found, the job exits immediately — no Claude call, no ticket creation.

A local state file (e.g. `last-digest-url.txt`) was considered and rejected: it is fragile across redeployments and creates a second source of truth outside Jira. The label approach is consistent with the existing label strategy (ADR 0004) and survives server restarts, multiple instances, and redeployments naturally.

The slug is derived from the last path segment of the blog post URL (e.g. `/blog/oasis-zscaler-partnership` → `oasis-zscaler-partnership`), then sanitized by replacing any character that is not alphanumeric or a hyphen. This produces a short, Jira-safe, human-readable label value. The colon separator in `blog-digest:<slug>` is intentional and consistent with the `type:` and `identity:` label conventions already in use.

**Note:** The Jira `/search/jql` endpoint returns `null` for `total` (unlike the deprecated GET `/search` which returned a numeric total). The deduplication check must use `issues.length > 0`, not `total > 0`.

## Blog content via HTML scraping, not RSS

`oasis.security/blog` has no RSS feed. The blog listing page is server-rendered and contains the post title (`h3`) and excerpt (`div[class*="text-size-regular"]`) in static HTML. The post body itself is JavaScript-rendered and inaccessible to a plain HTTP client. The listing page excerpt is sufficient context for a 2-3 sentence AI summary, so no headless browser is needed.

## Claude Haiku, called lazily

The AI summary uses `claude-haiku-4-5-20251001` — the most cost-efficient model in the Claude family. Claude is invoked only after the deduplication check confirms no ticket exists, ensuring the API is never called for a post that has already been processed.

## Scheduling via node-cron inside the Express server

The job runs every 4 hours (`0 */4 * * *`) using `node-cron` wired into `index.ts`. This requires no additional infrastructure. The alternative — a standalone script invoked by OS cron — was ruled out as it adds deployment complexity with no meaningful benefit for a PoC. If the job fails, the error is logged and the server continues running; the next scheduled run will retry.

## Consequences

- The digest ticket carries the labels `identityhub` and `blog-digest:<slug>`. The `identityhub` label means digest tickets will appear in the app's recent-tickets view alongside Finding Tickets. This is acceptable for a PoC; if separation is needed, a dedicated label (e.g. `identityhub-digest`) is a one-line change.
- The scraping selectors (`h3`, `div[class*="text-size-regular"]`) are tied to the current oasis.security blog HTML structure. A redesign of the blog page would break content extraction.
- `JIRA_BLOG_DIGEST_PROJECT_KEY` and `CLAUDE_API_KEY` are optional — the server starts normally without them and logs a warning instead of crashing.
