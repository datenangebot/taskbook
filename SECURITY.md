# Taskbook Security and Privacy

Taskbook content, including task titles, notes, plans, and daily-log entries,
is private user data. Authenticated access and CSRF protection remain enabled by
default. Do not add public-page, CSRF, CORS, or authentication bypasses unless
an explicit security decision justifies them.

Derive the authenticated user server-side. Never authorize access from a
client-provided user ID or an object ID alone: every read, update, and delete of
user-owned data must be scoped to and checked against its owner. Add cross-user
regression coverage when such resources are introduced.

Validate input server-side, return typed and intentionally exposed data only,
and use least privilege. Do not log task content, note content, plans, complete
request/response bodies containing private content, or secrets. Do not add
external trackers or unnecessary remote assets. Database migrations must be
safe and immutable once applied; security-sensitive changes require explicit
review.

## Standalone PWA exception

The explicitly approved public surface is limited to three read-only GET
routes: the standalone shell, static manifest, and static service-worker code
below `/apps/taskbook/pwa/`. They use Nextcloud's `PublicPage` and
`NoCSRFRequired` attributes only because an installed shell must start without
an active Nextcloud browser session. Route-boundary tests ensure no OCS Entry,
Context, settings, view, health, or sync action gains either attribute.

Those responses contain static asset locations and metadata only. They do not
contain authenticated identity, credentials, provisioning results, Taskbook
data, sync state, or server-side settings. The shell contains no inline script
or style, uses Nextcloud's CSP nonce for its local module, and permits workers
only from the same origin. The service worker scope and
`Service-Worker-Allowed` header are limited to the generated PWA route; it never
caches authenticated API responses.

Provisioning uses Nextcloud Login Flow v2. The normal password is never handled.
The returned dedicated app password stays in IndexedDB and is sent only by the
central same-origin fetch transport in an Authorization header. Fetch requests
omit browser credentials, so session cookies are not used as PWA API
authentication. Secrets are not written to URLs, DOM attributes, static
assets, logs, localStorage, or Cache Storage.

Disconnect attempts supported app-password revocation before clearing the
local database. If revocation cannot run while offline, local secrets are still
removed and the user is warned to revoke the token in Nextcloud. Authentication
failures retain local data and pending mutations until the user reconnects.
