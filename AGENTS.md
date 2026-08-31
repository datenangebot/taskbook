# Taskbook – Agent Instructions

## Working rules

Read `PRODUCT.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `API.md` when relevant
before changing implementation. Inspect existing callers, tests, and template
conventions before replacing code. Make small, focused changes; do not perform
unrelated refactoring, invent requirements, or change backward compatibility
without an explicit request. Source and developer-facing language is English.

Use supported Nextcloud APIs and `@nextcloud/vue` components where appropriate.
All visible strings are translatable. Accessibility is part of completion:
keyboard operation, semantic controls, focus behavior, visible focus, readable
contrast, zoom support, and non-colour-only state communication matter. Quick
capture and keyboard interaction are especially important product constraints.

Keep the backend layered: Controller -> Service -> Mapper / Repository ->
Database. Controllers stay thin. Do not couple Vue components to persistence or
server internals.

## Ownership and security

Task, note, plan, and daily-log content is private user data. Derive ownership
from the authenticated user; never trust a client-supplied user ID. Scope every
user-owned query by owner and verify ownership before updates or deletes. IDs
alone never authorize access. Add cross-user regression tests for new
user-owned resources.

Authenticated access and CSRF protection are defaults. Do not add `PublicPage`,
`NoCSRFRequired`, arbitrary CORS, or equivalent bypasses without an explicit
security decision. Validate inputs server-side, use typed outputs, apply least
privilege, do not log private content or request/response bodies, and never put
secrets in source control. Migrations must be safe and immutable once applied.

## APIs and OpenAPI

Use supported Nextcloud OCS/API conventions for public APIs. Keep contracts and
responses explicit, and use deterministic ordering and pagination where lists
can grow. `composer run openapi` is required because Taskbook currently exposes
an OCS endpoint. Generated `openapi*.json` files are version-controlled and
must be regenerated and included with API response/type changes. Do not put
internal Psalm-only aliases in extractor-visible response definitions.

## Dependencies, assets, and commits

Do not commit `vendor/`, `node_modules/`, caches, or temporary files. Production
frontend assets follow the repository packaging policy and are intentionally
tracked. Do not automatically run `cs:fix`, stage files, commit, reset, restore,
clean, stash, or mutate dependencies unless the requested work requires it.

Never create a commit unless explicitly asked. Use Conventional Commits and
create commits with `git commit -s`; do not fabricate a Signed-off-by trailer.
For intentionally rewritten pushed history, use `git push --force-with-lease`,
never plain `git push --force`.

## Verification

Do not rely on host PHP, Composer, Node, or npm. `scripts/verify.sh` discovers
its repository and enclosing Compose project from its own location, runs
Composer checks through the running `nextcloud` service at
`/var/www/html/apps-extra/taskbook`, runs Psalm in PHP 8.1, and uses an ephemeral
Node 24 container. Node dependencies are deterministically installed with
`npm ci` from `package-lock.json`; `node_modules` remains untracked. PHPUnit
verification disables result caching so cache output cannot dirty the worktree.

The applicable verification sequence is PHP CS, Psalm, PHPUnit, OpenAPI,
TypeScript, ESLint, Stylelint, production build, and `git diff --check`. Report
an inapplicable check as N/A rather than silently omitting it. OpenAPI warnings
are non-blocking unless its command exits non-zero.

## Definition of Done

A Taskbook change is complete only when requested behavior is implemented,
ownership and security boundaries are preserved, visible strings are
translatable, accessibility is considered, and appropriate tests are updated.
PHP CS, Psalm, PHPUnit, OpenAPI/artifact generation (when applicable), frontend
typecheck, lint, stylelint, build, and `git diff --check` must pass. No
accidental dependency, cache, or temporary files may be included.

## Frontend build workflow

After every Taskbook frontend change, run the documented Docker-based frontend
checks and compilation. Never assume host-local Node or npm is available. This
applies to `.vue`, TypeScript/JavaScript, styles, frontend assets and
entrypoints, router and API-client changes, Dashboard UI code, and frontend
dependency configuration.

A frontend change is not complete until the compiled assets used by the running
Nextcloud container have been regenerated and verified. Do not report a
frontend change as complete if only source files were changed and the frontend
bundle was not rebuilt. Follow the exact Docker workflow in `README.md`:
install the locked dependencies, run the applicable checks, run the production
build, verify the generated `js/` and `css/` assets, and confirm the running
Nextcloud container sees those assets. Use the Dockerized watch command only
when ongoing development needs it; it does not replace the final production
build.
