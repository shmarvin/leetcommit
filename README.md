# LeetCommit

A small Chrome extension for manually committing selected LeetCode solutions to GitHub. No automatic submission detection or uploads. No backend, dependencies, build step, analytics, or AI services.

## Install

1. Register an [OAuth App on GitHub](https://github.com/settings/applications/new).
   - Application name: `LeetCommit`
   - Homepage URL: your project repository URL.
   - Authorization callback URL: `https://github.com/` (device flow does not use it).
2. Open the app's settings and enable **Device Flow**.
3. Copy its **Client ID** into `config.js`. Do not create or add a client secret. The client ID is public and may be committed to your source repository.
4. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select this directory (the one containing `manifest.json`).
5. Visit `https://leetcode.com`, open the extension, and click **Connect GitHub**. Note the displayed code, click **Open GitHub**, and enter it. Return to the LeetCode tab and reopen the extension.
6. Choose a public repository you can write to. Choose an existing folder with **Browse**, type a new folder path, or enter `/` for the repository root.

The OAuth application must be registered by you before login works. Other users of your published source can register their own app, or use your configured public client ID. This package is not a Chrome Web Store publication.

## Use

1. Open a LeetCode problem with its Code tab visible, or open a specific submission (a URL containing `/submissions/123456/`).
2. Click **Capture**. On a problem page, this reads the current code and language from the live editor, including unsaved edits. On a submission page, it retrieves that submission's code instead. Neither path requires an accepted result.
3. Review or edit the title and code. The code includes three comment lines: number/title, problem URL, and difficulty.
4. Optionally expand **Approach** or **Commit message**.
5. Review the destination and click **Commit to GitHub**.

Example: `problems/0001-two-sum.cpp`, or `problems/0001-two-sum-hash-map.cpp`.

The same filename is updated, preserving prior commits. Identical content is skipped. The repository's default branch is used. Updates read the current file SHA; conflicts are reported rather than overwriting concurrent changes blindly. Empty repositories are supported. Branch protection may reject direct commits.

Drafts persist locally when the popup closes. Upload requests run in the extension service worker, independently of the popup. Reopen the popup to see the latest upload result. Chrome shutdown, service-worker termination, or network interruption can still interrupt a request; check GitHub before retrying. There is no automatic upload retry.

**Metadata** is a collapsed manual fallback for language, difficulty, and URL. If capture fails, enter these plus a title such as `1. Two Sum` and paste your code. Automatic headers are inserted on capture; manually pasted code is left as entered. Editing metadata refreshes the header only if its original generated form is still intact.

## Supported languages

C++, C, Python/Python3, Java, JavaScript, TypeScript, Go, Rust, C#, Ruby, Swift, Kotlin, Scala, PHP, Dart, Elixir, Erlang, R, SQL variants, Bash, and Racket. Unrecognized languages fail explicitly instead of guessing an extension. Add mappings in `core.js` for future LeetCode languages. PHP uses a separate PHP comment block before the captured source.

## Permissions and privacy

- `activeTab` / `scripting`: read the selected submission on an explicit Capture click. The action is enabled only on `https://leetcode.com`.
- `declarativeContent`: enable the toolbar action on LeetCode, without permanent access to LeetCode pages.
- GitHub host permissions: authenticate and call the GitHub API.
- `storage`: retain the access token, draft, preferences, and upload result locally; access is restricted to trusted extension contexts. Tokens are not encrypted at rest and are never included in repository files.
- `alarms`: resume device authorization checks if the popup closes. This is authentication polling, not submission polling.

OAuth requests `public_repo`: it can write public repositories accessible to the account, not only your chosen destination. The application displays only public writable repositories. Disconnect removes its local token; revoke access in GitHub Settings → Applications to invalidate the grant.

Capture reads the live editor on problem pages and makes one on-demand request to LeetCode's internal GraphQL API using your existing LeetCode session for problem metadata or submission details. That API can change or reject access. LeetCode's terms prohibit scraping; a manual trigger does not settle whether this capture is permitted. No problem descriptions, examples, or constraints are copied. No data is sent anywhere except LeetCode and GitHub.

## Development

Plain JavaScript ES modules; no compilation or install required. Run tests with Node 20+:

```sh
npm test
```

Tests cover filename normalization, language headers, Unicode encoding, problem-editor and submission capture, creation, unchanged-content skipping, and update conflicts. Live OAuth, LeetCode session capture, and actual GitHub writes require browser testing with your own accounts.
