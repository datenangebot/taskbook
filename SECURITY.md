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
