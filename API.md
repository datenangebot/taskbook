# Taskbook API

Taskbook exposes its authenticated product API below
`/ocs/v2.php/apps/taskbook/api/v1`. Browser-independent clients send an app
password with HTTP Basic authentication, request JSON, and include
`OCS-APIRequest: true`. Ownership always comes from the authenticated identity;
no request accepts a user ID for authorization.

## Offline synchronization

`POST /sync` accepts one bounded batch of at most 100 ordered mutations:

```json
{
  "installationId": "uuid-v4",
  "cursor": 42,
  "mutations": [{
    "operationId": "uuid-v4",
    "clientUid": "uuid-v4",
    "type": "create|update|delete",
    "baseRevision": 3,
    "entry": {
      "text": "…",
      "type": "task",
      "important": false,
      "contextId": 1,
      "referenceType": "day",
      "targetDate": "2026-09-01",
      "status": "open"
    }
  }]
}
```

The initial request uses a null cursor and returns the full working dataset.
Later requests return change-log events after the supplied cursor, including
deletion tombstones. Responses contain `canonicalChanges`, `deletions`, the
complete current Context set and default Context, acknowledged operation IDs,
conflicts, `nextCursor`, `hasMore`, server time, locale, and canonical timezone.
Pull pages contain at most 500 change events.

Every Entry has a stable `clientUid` and server-owned integer `revision`.
Updates and deletes apply only when `baseRevision` matches. A mismatch returns
both the submitted mutable fields and current canonical server Entry for user
resolution. `operationId` is retained in a user-scoped idempotency ledger, so a
retry returns its original result without repeating the mutation.

`GET /health` is an authenticated, lightweight reachability check. It returns
`status: ok` and server time. Both sync endpoints are rate limited. They are not
public and do not opt out of CSRF protection.

## Public PWA shell

The only anonymous Taskbook routes are the read-only static shell resources at
`/apps/taskbook/pwa/`, `/manifest.webmanifest`, and `/service-worker.js`. They
are deliberately outside the OCS data contract and never include account,
credential, Entry, Context, or sync data.

Public API changes use supported Nextcloud OCS/API conventions, typed
controller responses, explicit contracts, deterministic ordering and pagination
where lists can grow, and normal authenticated/CSRF-protected access. Do not
expose database representations unnecessarily.

Because an OCS endpoint exists, `composer run openapi` is mandatory. Generated
`openapi*.json` artifacts are version-controlled: regenerate and include them
when API response or type definitions change. Extraction must complete without
fatal errors; non-fatal extractor warnings do not block a pass when the command
exits successfully.
