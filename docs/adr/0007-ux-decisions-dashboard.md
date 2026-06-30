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

**Dropdown content was transparent, showing elements behind it.**
The `SelectContent` component from shadcn/ui uses the `bg-popover` Tailwind utility, which maps to a CSS variable `--popover`. The `popover` color was never registered in `tailwind.config.ts`, so Tailwind emitted no background rule and the dropdown appeared transparent. The fix was to add `popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' }` to the Tailwind color config — the same pattern already used for `card`, `primary`, etc. No component code changed.

**The browser tab title was renamed from "frontend" to "IdentityHub".**
The Vite scaffold default leaves `<title>frontend</title>` in `index.html`. This is the string shown in browser tabs, history, and bookmarks — generic enough to be confusing when the user has multiple tabs open. Changed to "IdentityHub" to match the product name.

**The Oasis Security colour palette was applied across the app.**
The initial implementation used shadcn/ui's default slate/navy theme, which had no relationship to the Oasis Security brand. The palette was extracted directly from oasis.security via the browser's computed styles and CSS custom properties:
- **Electric indigo** `#4f5cd6` replaces the dark navy as the primary brand and CTA colour. Used for buttons, the "Hub" logotype accent, badges, and the feature-list bullet dots.
- **Midnight black** `#0d0d19` replaces generic slate for body text and headings — a near-black with a slight blue-navy undertone, consistent with Oasis's foreground.
- **Mist grey** `#bbbecf` maps to `--muted-foreground` for secondary labels and descriptions.
- **Inkstone purple** `#504e62` is used for tertiary text (descriptions, disconnected Jira URL, sign-out at rest).
- The `--primary` CSS variable in `index.css` is now `234 62% 57%` (HSL for `#4f5cd6`), so all shadcn/ui components that reference `primary` — buttons, rings, focus states — pick up the indigo automatically without per-component changes.
- The login page hero background mirrors the Oasis product page: a diagonal linear gradient from white through `#eaecf8` to `#c8ccee`, overlaid with a dot-grid pattern (`radial-gradient` at 28 px intervals) using the midnight-black colour at 8% opacity.
- The "Connect Jira" amber warning banner was replaced with an indigo-tinted equivalent (`bg-[#eaecf8]`, `border-[#c8ccee]`) so the palette is consistent across all states.

**The Oasis Security logo was added to the header and login card.**
To establish the relationship between IdentityHub and the Oasis platform, the Oasis wordmark SVG (viewBox `0 0 91 21`, five paths, `fill="currentColor"`) was extracted from the oasis.security navigation and saved to `public/oasis-logo.svg`. It appears in the header to the left of a thin vertical divider before the "IdentityHub" product name, and at the top of the login card above the product name. Using `currentColor` means the logo inherits the surrounding text colour and will adapt automatically if the header background changes.

## Consequences

The `RecentTicket` shared type now has an optional `severity` field. Backend callers that construct `RecentTicket` objects without populating it (e.g. the service-account path) are unaffected — the field is optional and the UI degrades gracefully by omitting the severity indicator.

The `newTicketKey` highlight relies on a `setTimeout` in `Dashboard`. If the user navigates away before 2.5 seconds the timeout fires against an unmounted component, but because it only calls `setNewTicketKey(undefined)` on already-unmounted state, React will silently ignore it — no cleanup needed.
