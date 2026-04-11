# Publishing getbumps to npm

Package name: **getbumps** (CLI command: `npx getbumps`).  
Source repo: [https://github.com/barisermut/bumps](https://github.com/barisermut/bumps)

## One-time: npm account

1. Go to [https://www.npmjs.com/signup](https://www.npmjs.com/signup) and create an account (or log in).
2. Verify your email when npm sends the link.
3. Optional but recommended: enable **2FA** on npm (Account → Security). If 2FA is on, publishes need a one-time password:
  ```bash
   npm publish --otp=123456
  ```

## One-time: log in on this machine

From any directory:

```bash
npm login
```

Enter username, password, and email (or use an **access token**: npm → Access Tokens → Granular/Classic, then `npm login` / `npm config set` per npm docs).

Check:

```bash
npm whoami
```

## Before every publish

From the **repo root** (`bumps/`):

```bash
npm test
cd dashboard && npm install && npm run build && cd ..
npm pack --dry-run
```

- **`prepack`** copies `dashboard/dist` → `publish-dist/` for the tarball. If `dashboard/dist` is missing, the check script fails — build the dashboard first.
- Bump **`version`** in `package.json` when this is not the first release (semver).

## Name availability (first publish only)

```bash
npm view getbumps
```

If it prints `404`, the name is free. If another package exists, you must rename in `package.json` (not the case for `getbumps` unless taken).

## Publish

Public, unscoped package (default):

```bash
npm publish
```

With 2FA:

```bash
npm publish --otp=YOUR_CODE
```

First publish: npm may ask you to confirm the package name and that you’re OK publishing publicly.

## After publish

- Package page: [https://www.npmjs.com/package/getbumps](https://www.npmjs.com/package/getbumps)
- Smoke test (any directory):
  ```bash
  npx getbumps
  ```
  Open **http://127.0.0.1:3456** in the browser.
- Tag the release on GitHub (e.g. `v1.0.0`) to match `package.json` version.

## Later releases

1. Commit your changes on `main` (or your release branch).
2. Bump **`version`** in `package.json` using **semver**:
   - Edit by hand, **or** from the repo root (creates a git commit + tag if the repo is clean and has git):
     - `npm version patch` → `1.0.0` → `1.0.1` (bugfixes / small changes)
     - `npm version minor` → `1.0.1` → `1.1.0` (new features, backward compatible)
     - `npm version major` → breaking / large rewrites  
   - Add `--no-git-tag-version` if you only want the `package.json` bump without git metadata.
3. Run **Before every publish** (tests + dashboard build + optional `npm pack --dry-run`).
4. **`npm publish`** (and `--otp=…` if 2FA).  
5. **`git push`** and **`git push --tags`** if you used `npm version` so GitHub matches the registry.

For this repo, ingestion/UI changes since `1.0.0` are typically a **`minor`** bump (e.g. `1.1.0`) unless you only ship tiny fixes (`patch`).

## `npm warn publish` / `npm pkg fix`

If npm says it **auto-corrected** `package.json` (often `repository.url` → `git+https://…`), run at the repo root:

```bash
npm pkg fix
```

Commit whatever it changes. For `repository`, npm’s canonical form is:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/barisermut/bumps.git"
}
```

That matches what the registry normalizes anyway; putting it in the file removes the warning on the next publish.

## Useful links

- [npm publish docs](https://docs.npmjs.com/cli/v10/commands/npm-publish)  
- [Package name rules](https://docs.npmjs.com/package-name-guidelines)

