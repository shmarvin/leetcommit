#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf 'LeetCommit is an unpacked Chrome extension; no dev server is needed.\n\n'
printf '1. Open chrome://extensions and enable Developer mode.\n'
printf '2. Click Load unpacked and select:\n   %s\n' "$(pwd -P)"
printf '3. Reload the extension there after editing files.\n\n'
printf 'Run tests in this workspace with: npm test\n'
