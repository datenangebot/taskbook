# Taskbook

A template to get started with Nextcloud app development.

## Usage

- To get started easily use the [Appstore App generator](https://apps.nextcloud.com/developer/apps/generate) to
  dynamically generate an App based on this repository with all the constants prefilled.
- Alternatively you can use the "Use this template" button on the top of this page to create a new repository based on
  this repository. Afterwards adjust all the necessary constants like App ID, namespace, descriptions etc.

Once your app is ready follow the [instructions](https://nextcloudappstore.readthedocs.io/en/latest/developer.html) to
upload it to the Appstore.

## Frontend development

Taskbook does not require host-local Node or npm. Frontend tooling is executed
through the Docker development environment. Run these commands from the
Taskbook repository root; the repository is mounted at `/app` in an ephemeral
Node 24 container.

Install the dependency versions locked in `package-lock.json`:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci'
```

When intentionally changing frontend dependency declarations, refresh only the
lockfile first, then perform the deterministic installation above:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm install --package-lock-only --force'
```

Run each available frontend check in Docker:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run typecheck'
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run lint'
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run stylelint'
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run test:unit'
```

Compile the production assets that Nextcloud serves:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run build'
```

The build writes the tracked production bundles to `js/` and `css/`. After
modifying frontend source code, regenerate these compiled assets before testing
Taskbook in Nextcloud. Verify that the generated files are present both in this
checkout and at `/var/www/html/apps-extra/taskbook/js` and
`/var/www/html/apps-extra/taskbook/css` in the running `nextcloud` container.

### Browser cache during local development

The Docker development instance currently runs Nextcloud with `debug` enabled.
Nextcloud deliberately omits its normal asset-version query parameter in that
mode to support browser workspace mapping. The proxy can therefore retain an
unchanged entry-bundle URL in a browser cache after a rebuild. When validating a
frontend change, use the browser's **Disable cache** option in DevTools and
perform a hard reload (or clear the cached Taskbook assets) before concluding
that the running UI is stale. Do not work around this with application-specific
random query parameters. In a normal non-debug deployment, Nextcloud restores
its standard versioned asset URLs.

For ongoing development, the Dockerized watch process is available:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run watch'
```

For ongoing standalone PWA development, run its independent watcher instead:

```sh
docker run --rm -v "$PWD":/app -w /app node:24-bookworm sh -lc 'npm ci && npm run watch:pwa'
```

Stop the watch process with `Ctrl+C`, then run the production build before
considering the frontend change complete. A source-only frontend change is
never complete: run the applicable Docker checks, rebuild the assets, and
verify that the running Nextcloud instance loads the new JavaScript and CSS.

## Resources

### Documentation for developers:

- General documentation and tutorials: https://nextcloud.com/developer
- Technical documentation: https://docs.nextcloud.com/server/latest/developer_manual

### Help for developers:

- Official community chat: https://cloud.nextcloud.com/call/xs25tz5y
- Official community forum: https://help.nextcloud.com/c/dev/11
