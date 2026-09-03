#!/usr/bin/env bash

set -euo pipefail

fail() {
	echo "Taskbook version consistency check failed: $*" >&2
	exit 1
}

app_version="$(sed -nE 's|^[[:space:]]*<version>([^<]+)</version>[[:space:]]*$|\1|p' appinfo/info.xml)"
package_version="$(awk '
	/^[[:space:]]*"version"[[:space:]]*:/ {
		version = $0
		sub(/^[^:]*:[[:space:]]*"/, "", version)
		sub(/".*$/, "", version)
		print version
		exit
	}
' package.json)"
lockfile_version="$(awk '
	/^[[:space:]]*"version"[[:space:]]*:/ {
		version = $0
		sub(/^[^:]*:[[:space:]]*"/, "", version)
		sub(/".*$/, "", version)
		print version
		exit
	}
' package-lock.json)"
lockfile_root_version="$(awk '
	/^[[:space:]]*"": \{/ { in_root_package = 1; next }
	in_root_package && /^[[:space:]]*"version"[[:space:]]*:/ {
		version = $0
		sub(/^[^:]*:[[:space:]]*"/, "", version)
		sub(/".*$/, "", version)
		print version
		exit
	}
' package-lock.json)"
openapi_version="$(awk '
	/^[[:space:]]*"info"[[:space:]]*:/ { in_info = 1; next }
	in_info && /^[[:space:]]*"version"[[:space:]]*:/ {
		version = $0
		sub(/^[^:]*:[[:space:]]*"/, "", version)
		sub(/".*$/, "", version)
		print version
		exit
	}
' openapi.json)"

[[ -n "$app_version" ]] || fail 'appinfo/info.xml does not contain an app version.'

for metadata in \
	"package.json:$package_version" \
	"package-lock.json top-level:$lockfile_version" \
	"package-lock.json root package:$lockfile_root_version" \
	"openapi.json info.version:$openapi_version"; do
	name="${metadata%%:*}"
	version="${metadata#*:}"
	[[ "$version" == "$app_version" ]] || fail "$name is '$version', expected '$app_version' from appinfo/info.xml."
done

echo "Taskbook version metadata is consistent: $app_version"
