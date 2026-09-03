# Taskbook Architecture

Taskbook is a Nextcloud application with its full Vue frontend plus a smaller,
independently built standalone PWA. The normal frontend remains authoritative
for the complete product. The PWA intentionally contains only Day, Quick Add,
full Entry editing, and Future Log.

Backend responsibilities are separated as follows:

```text
Controller -> Service -> Mapper / Repository -> Database
```

Controllers validate request shape, call services, and return typed responses.
Business rules belong in services; persistence and user-scoped queries belong in
mappers or repositories. Vue components use the public application API rather
than persistence or server internals directly.

The standalone dependency boundary is:

```text
src/shared     framework-independent domain/date/parser/grouping logic
src/pwa        standalone DOM UI, fetch transport, IndexedDB, sync coordinator
src/**         normal Nextcloud Vue application
```

`src/shared` and `src/pwa` do not import Nextcloud UI packages or require
Nextcloud JavaScript globals. The PWA has separate Vite application and worker
builds. Its stable outputs are `js/taskbook-pwa.mjs`,
`css/taskbook-pwa.css`, and `js/taskbook-pwa-service-worker.mjs`; the normal
Taskbook entry does not import them.

The PWA shell is served at `/apps/taskbook/pwa/`. Its manifest uses that URL as
both start URL and scope. The service worker is registered and permitted only
for that path. Cache Storage contains only versioned shell resources. Private
account, Entry, Context, outbox, cursor, and conflict state is held in the
versioned `taskbook-pwa` IndexedDB database.

Offline writes update canonical local state and the outbox in one IndexedDB
transaction. The coordinator pushes ordered idempotent mutations and reduces
canonical changes/tombstones back into IndexedDB. The backend continues to use
the same Controller -> Service -> Mapper / Repository -> Database layering.

Do not introduce another data model, API, or persistence layer before a
concrete product requirement requires it.
