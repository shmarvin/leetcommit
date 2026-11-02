# Paradev workspaces

Paradev reads `config.json` here. Create a workspace to run setup, then use
the **Run** button for instructions to load that workspace as an unpacked
Chrome extension. Run `npm test` for the Node.js tests (Node 20+).

Setup copies missing, nonignored untracked files from `$SUPERSET_ROOT_PATH`,
plus ignored `.env` and `.env.*` files, including nested environment files.
It preserves existing workspace files and excludes lifecycle configuration.
Keep secrets ignored in the main checkout and workspace; never commit `.env`
files. Once the application sources are committed, worktrees receive those
files from Git normally. Copied files are snapshots, not synchronized links.

This extension has no dependencies to install and no development server.
Setup starts no services, so teardown has nothing to stop. Parallel workspaces
do not reserve or compete for ports. Load each workspace directory separately
in Chrome when testing multiple versions.

Commit `.superset/` to make this configuration available to future workspaces.
