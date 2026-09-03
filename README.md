# Taskbook

**Tasks, plans, and notes in one simple daily workspace for Nextcloud.**

Taskbook is a community-maintained Nextcloud app for organizing everyday tasks, plans, and notes in a journal-oriented workspace.

It combines day, week, month, and future planning with fast capture, contexts, keyboard navigation, and an optional standalone Progressive Web App for offline use.

## Features

### Daily planning

Taskbook provides dedicated views for:

- **Overview** — quick links, statistics, and overdue items
- **Day** — focused daily entries with inherited week and month items
- **Week** — a compact weekly overview with day and week entries
- **Month** — month-level entries plus a calendar summary
- **Future Log** — later items and entries planned for future months

Entries can represent tasks, appointments, notes and migrated tasks tasks. Open and completed entries remain visible, while migrated tasks preserve their original date and current target.

### Quick capture

New entries can be created quickly with the **New entry** dialog or keyboard shortcuts.

Rapid logging supports commands for:

- priority
- entry type
- day, week, month, or no time reference
- relative and explicit dates
- contexts through `@shortcut`

Recognized commands are consumed only after they are completed, so normal text remains unaffected.

### Contexts

Every entry belongs to a context.

Contexts have:

- a title
- an emoji
- an optional shortcut such as `@w`
- one default context per user

Contexts can be created and edited in Taskbook settings. Shortcuts are unique per user and can be used during rapid capture.

### Keyboard navigation

Taskbook supports keyboard-first navigation while keeping shortcuts inactive inside text fields, editors, dialogs, and other interactive controls.

Examples include:

- `Shift+O` — Overview
- `Shift+D` — Day
- `Shift+W` — Week
- `Shift+M` — Month
- `Shift+F` — Future Log
- `Shift+N` — New entry

Period and entry lists also support keyboard navigation where appropriate.

### Nextcloud Dashboard

Taskbook integrates with the native Nextcloud Dashboard and provides a compact view of current entries with quick access to capture.

## Progressive Web App

Taskbook includes a standalone PWA intended for mobile and offline-first use.

The PWA is intentionally smaller than the full Nextcloud application and focuses on:

- Day
- Future Log
- Quick Add
- full entry editing
- offline storage
- synchronization when connectivity returns

The PWA has its own application shell and does not depend on Nextcloud UI resources at runtime.

Authentication uses **Nextcloud Login Flow v2** and a dedicated app password. The user's normal Nextcloud password is never stored by Taskbook.

Offline data, pending mutations, synchronization metadata, and conflicts are stored locally in IndexedDB. The service worker is scoped only to the Taskbook PWA.

## Privacy and security

Taskbook is designed around user-scoped data access:

- entries and contexts belong to the signed-in user
- clients cannot choose an arbitrary owner ID
- normal Taskbook data APIs require authentication
- the standalone PWA shell may be public, but Taskbook data and sync APIs are not
- PWA credentials are stored locally in IndexedDB, not `localStorage`
- the PWA service worker does not cache authenticated API responses
- diagnostic information must not contain passwords, app passwords, authorization headers, cookies, or login-flow tokens

### Reporting security issues

**Do not create public GitHub issues for security vulnerabilities or suspected vulnerabilities.**

Please report them privately by email:

**mail@datenangebot.de**

Avoid including credentials, tokens, or private Taskbook data in reports.

## API

Taskbook is API-first.

The normal Nextcloud frontend and authorized clients use the versioned Taskbook OCS API under:

```text
/ocs/v2.php/apps/taskbook/api/v1/
```

The backend follows a thin Controller → Service → Mapper/Repository structure with authenticated user scoping.

API definitions and generated OpenAPI artifacts are maintained with the source where applicable.

## Installation

### Nextcloud App Store

Once a compatible release is available, the recommended installation method is the Nextcloud App Store.

Open **Apps** in Nextcloud, find **Taskbook**, and enable it.

The supported Nextcloud versions are declared in `appinfo/info.xml`.

### Testing a Git branch

Compiled frontend assets are intentionally kept in the repository, so a development branch can be cloned into a Nextcloud app directory without requiring an initial frontend build.

```bash
cd /path/to/nextcloud/apps
git clone https://github.com/datenangebot/taskbook.git taskbook
```

Then enable the app through Nextcloud's app management or with `occ`.

> Development branches are not production releases.

## Development

Taskbook is a Nextcloud PHP application with a Vue 3 and TypeScript frontend.

The repository uses a **Docker-only frontend workflow**. Do not run project Node/npm commands directly on the host.

Use the scripts and container workflow documented in `AGENTS.md` and this repository for:

- TypeScript checking
- ESLint
- Stylelint
- unit tests
- PHP checks
- OpenAPI verification
- production builds

A full verification can be run with:

```bash
./scripts/verify.sh
```

Compiled frontend assets are committed. Frontend source changes must include the corresponding production build output.

Do not commit `node_modules/`, local caches, credentials, or other machine-specific files.

## Bugs and feature requests

Non-security bugs and feature requests are welcome on GitHub.

When reporting a problem, include:

- a clear description
- steps to reproduce
- expected and actual behavior
- Taskbook and Nextcloud versions
- browser/device information where relevant
- sanitized logs when useful

Remove private entry content, credentials, tokens, and other sensitive information before attaching logs.

## Contributions

Taskbook is developed primarily through an AI-assisted workflow, with human maintainers responsible for product direction, review, security handling, and merge decisions.

Focused fixes, tests, documentation, accessibility improvements, and well-scoped contributions are welcome.

Please avoid unrelated refactors and preserve the existing domain model, Nextcloud integration, privacy rules, and PWA/runtime boundaries.

Contributions must follow the repository's DCO requirements and include a `Signed-off-by` trailer.

## Localization

English is the source language for user-facing strings.

Visible UI strings should use Nextcloud's localization mechanisms so they can participate in the normal translation workflow.

## License

See `COPYING` and the repository license information for details.

## Acknowledgements

Taskbook is inspired by journal-oriented task planning and rapid logging concepts while remaining an independent Nextcloud application.

Thanks to everyone who tests, reports issues, translates, documents, and contributes to the project.
