# Taskbook API

Taskbook currently includes the template OCS API endpoint documented in
`openapi.json`. It is not a finalized Taskbook product API.

Any future public API uses supported Nextcloud OCS/API conventions, typed
controller responses, explicit contracts, deterministic ordering and pagination
where lists can grow, and normal authenticated/CSRF-protected access. Do not
expose database representations unnecessarily.

Because an OCS endpoint exists, `composer run openapi` is mandatory. Generated
`openapi*.json` artifacts are version-controlled: regenerate and include them
when API response or type definitions change. Extraction must complete without
fatal errors; non-fatal extractor warnings do not block a pass when the command
exits successfully.
