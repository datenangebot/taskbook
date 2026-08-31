# Taskbook Architecture

Taskbook is a classic Nextcloud application with a Vue frontend. Follow the
existing application structure and supported Nextcloud APIs for the app's
minimum supported version.

Backend responsibilities are separated as follows:

```text
Controller -> Service -> Mapper / Repository -> Database
```

Controllers validate request shape, call services, and return typed responses.
Business rules belong in services; persistence and user-scoped queries belong in
mappers or repositories. Vue components use the public application API rather
than persistence or server internals directly.

Do not introduce a data model, API, or persistence layer before a concrete
product requirement requires it.
