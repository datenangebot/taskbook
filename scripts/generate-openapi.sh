#!/usr/bin/env bash

set -euo pipefail

extractor='vendor-bin/openapi-extractor/vendor/nextcloud/openapi-extractor/generate-spec.php'
patch_file='patches/openapi-extractor-use-app-version.patch'

if grep -Fq "'version' => \$appVersion," "$extractor"; then
	:
elif patch --dry-run --forward -p1 < "$patch_file" >/dev/null; then
	patch --forward -p1 < "$patch_file"
else
	echo "OpenAPI extractor source does not match the supported compatibility patch." >&2
	exit 1
fi

exec ./vendor/bin/generate-spec "$@"
