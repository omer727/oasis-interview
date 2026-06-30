# NHI finding fields map to standard Jira fields only — no custom fields

Finding Tickets use only Jira's built-in fields: `summary` (title), `description` (ADF), `priority` (severity), and `labels` (finding type and identity type). No custom fields are used.

NHI data naturally suggests custom fields — severity, finding type, and identity type are first-class concepts that would normally get their own Jira field definitions. Custom fields were ruled out because creating them requires Jira project admin access, making the PoC non-portable: it would only work on Jira projects where the reviewer had already configured the right schema. Standard fields work on any Jira project out of the box.

The mapping is:
- `severity` → Jira `priority` (Critical→Highest, High→High, Medium→Medium, Low→Low)
- `findingType` → label with prefix `type:` (e.g. `type:stale-credential`)
- `identityType` → label with prefix `identity:` (e.g. `identity:service-account`)

Labels are human-readable in Jira's UI and filterable via JQL, which preserves most of the value of dedicated fields without requiring any project configuration.
