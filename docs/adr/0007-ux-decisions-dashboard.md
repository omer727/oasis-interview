# UX decisions: dashboard interactions and visual polish

A series of UX improvements were made to the dashboard after the initial implementation. The decisions are recorded together because they form a coherent interaction model rather than isolated changes.

## Decisions

**Auto-select the first Jira project on load.**
The dashboard previously rendered an empty "Select a project…" state after connecting Jira, with no obvious next step. Projects are now auto-selected via a `useEffect` when the project list first resolves. The user lands on a usable state without any extra click.

**Project selection lives only in the toolbar, not inside the Create Finding dialog.**
An earlier version of the dialog had a duplicate project selector. This created two sources of truth and required the user to pick a project twice. The dialog now receives `selectedProjectKey` as a prop and displays the project as a read-only badge in the title. Changing the project always happens in the toolbar.

**Connect Jira buttons disable and show a spinner immediately on click.**
The OAuth redirect is a full-page navigation that can take a moment. Without feedback, users may click twice, producing duplicate OAuth flows. Both the header button and the banner button now set a local `isConnecting` state on click, disabling themselves and showing a `Loader2` spinner for the duration.

**Disconnect Jira requires a confirmation dialog.**
The disconnect button lived next to the Jira site name with no confirmation. A single misclick would drop the session token and require the user to re-authorise. A confirmation dialog with a destructive "Disconnect" button and a Cancel option now gates the action.

**Severity is surfaced on the Recent Findings list.**
The list previously showed only a ticket key, title, and timestamp. The Jira `priority` field is now fetched alongside `summary` and `created`, mapped back to the app's `Severity` type via a reverse lookup in `mappers.ts`, and added to the `RecentTicket` shared type as an optional field. Each list row shows a colored dot and a small severity badge (red=Critical, orange=High, yellow=Medium, blue=Low).

**Newly created tickets are briefly highlighted in the list.**
After a ticket is created the list invalidates and refetches, but the new row was visually indistinguishable from existing ones. A `newTicketKey` string is now lifted to `Dashboard`, set in the `onCreated` callback from `CreateFindingForm`, and cleared after 2.5 seconds via `setTimeout`. `RecentTickets` applies an amber background with a `transition-colors duration-1000` fade to the matching row.

**"Sign out" is visually separated from other header controls.**
The sign-out button had the same ghost style as every other button in the header, giving it no visual hierarchy. A thin vertical divider (`<span>` with `w-px h-4 bg-slate-200`) now precedes it, and the button turns red on hover (`hover:text-red-600 hover:bg-red-50`) to signal its destructive nature without being alarming at rest.

**The login page explains what NHI means.**
New users had no context for "NHI findings" before signing in. The login card now includes a one-sentence product description and a three-item list of concrete finding categories (stale credentials, overprivileged identities, expiring secrets) so users understand the product before committing to sign-in.

## Consequences

The `RecentTicket` shared type now has an optional `severity` field. Backend callers that construct `RecentTicket` objects without populating it (e.g. the service-account path) are unaffected — the field is optional and the UI degrades gracefully by omitting the severity indicator.

The `newTicketKey` highlight relies on a `setTimeout` in `Dashboard`. If the user navigates away before 2.5 seconds the timeout fires against an unmounted component, but because it only calls `setNewTicketKey(undefined)` on already-unmounted state, React will silently ignore it — no cleanup needed.
