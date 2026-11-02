#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

root="${SUPERSET_ROOT_PATH:?Paradev must set SUPERSET_ROOT_PATH to the main checkout}"
root="$(cd "$root" && pwd -P)"
workspace="$(pwd -P)"

copy_missing() {
  local relative="$1"
  # Workspace lifecycle scripts always come from this branch.
  case "$relative" in .superset/*|.paradev/*) return ;; esac
  if [[ ! -e "$relative" && ! -L "$relative" ]]; then
    mkdir -p "$(dirname "$relative")"
    cp -P "$root/$relative" "$relative"
  fi
}

if [[ "$root" != "$workspace" ]]; then
  # The initial app is untracked in the main checkout. Use Git's exclusions
  # so caches, node_modules, and other ignored artifacts aren't duplicated.
  while IFS= read -r -d '' relative; do
    copy_missing "$relative"
  done < <(git -C "$root" ls-files --others --exclude-standard -z)

  # Local environment files may be ignored; copy these explicitly as well.
  while IFS= read -r -d '' relative; do
    copy_missing "$relative"
  done < <(git -C "$root" ls-files --others --ignored --exclude-standard -z -- '.env' '.env.*' '**/.env' '**/.env.*' ':!:node_modules/**')
fi

command -v node >/dev/null || { echo 'Install Node.js 20+ to develop LeetCommit.' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20+ is required"); process.exit(1); }'
[[ -f manifest.json && -f package.json ]] || {
  echo 'Missing extension sources. Keep them in the main checkout or commit them before creating workspaces.' >&2
  exit 1
}
echo 'LeetCommit workspace ready. This extension has no dependencies to install.'
