# Firefox Extension Deployment Strategy

## Current State

- Extension: **Hutch** — a reading list saver for Firefox
- Manifest: v2, targeting Firefox 91+
- Build: esbuild bundles to `dist-extension/` via `pnpm dist:extension`
- Data: in-memory providers (no backend integration yet)
- CI: `pnpm check` runs lint + tests, but no extension-specific build or distribution step

## Distribution Channel

### Recommended: AMO (addons.mozilla.org) — Listed

Publish publicly on the Firefox Add-ons store. This is the standard distribution path and provides:

- Automatic updates for users
- Discovery through AMO search
- Trust signal (Mozilla review process)
- No self-hosting infrastructure needed

**Alternative:** AMO Unlisted (self-hosted). Mozilla still signs the `.xpi`, but you host the update manifest yourself (e.g., on S3). Use this only if the extension should not be publicly discoverable.

## Implementation Plan

### 1. Add `web-ext` tooling

Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) CLI handles packaging, linting, running, and signing extensions.

```bash
pnpm add --save-dev web-ext --filter firefox-extension
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "ext:build": "node scripts/build-extension.js",
    "ext:lint": "web-ext lint --source-dir dist-extension",
    "ext:package": "web-ext build --source-dir dist-extension --artifacts-dir dist-artifacts --overwrite-dest",
    "ext:run": "web-ext run --source-dir dist-extension"
  }
}
```

- `ext:build` — compile TypeScript and copy assets to `dist-extension/`
- `ext:lint` — validate the built extension against Mozilla's rules
- `ext:package` — create a `.zip` artifact in `dist-artifacts/`
- `ext:run` — launch Firefox with the extension loaded for local testing

### 2. Version management

Keep `manifest.json` version and `package.json` version in sync. Add a script to bump both:

```bash
# scripts/bump-version.js
# Reads new version from CLI arg, updates both manifest.json and package.json
```

AMO rejects re-uploads of the same version, so every submission needs a unique version string. Use semver: `MAJOR.MINOR.PATCH`.

### 3. CI pipeline changes

Extend `.github/workflows/ci.yml` to include the extension build and lint:

```yaml
# Inside the existing `check` job, after pnpm install:
- run: pnpm --filter firefox-extension ext:build
- run: pnpm --filter firefox-extension ext:lint
```

This ensures every PR validates that the extension builds cleanly and passes Mozilla's lint rules.

### 4. Deployment workflow

Create `.github/workflows/deploy-extension.yml`:

```yaml
name: Deploy Firefox Extension

on:
  push:
    tags:
      - 'extension-v*'  # Trigger on tags like extension-v1.2.0

permissions:
  contents: read

jobs:
  deploy-extension:
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build extension
        run: pnpm --filter firefox-extension ext:build

      - name: Lint extension
        run: pnpm --filter firefox-extension ext:lint

      - name: Sign and upload to AMO
        run: |
          pnpm --filter firefox-extension web-ext sign \
            --source-dir dist-extension \
            --artifacts-dir dist-artifacts \
            --channel listed \
            --api-key ${{ secrets.AMO_API_KEY }} \
            --api-secret ${{ secrets.AMO_API_SECRET }}
        working-directory: projects/firefox-extension

      - name: Create source archive for Mozilla review
        run: git archive --format=zip --output=projects/firefox-extension/dist-artifacts/source.zip HEAD

      - name: Upload artifact to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            projects/firefox-extension/dist-artifacts/*.xpi
            projects/firefox-extension/dist-artifacts/source.zip
```

### 5. Required secrets

Add these to the GitHub repository's `prod` environment:

| Secret | Source |
|--------|--------|
| `AMO_API_KEY` | [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/) — the JWT issuer |
| `AMO_API_SECRET` | AMO API credentials — the JWT secret |

Generate these at: https://addons.mozilla.org/developers/addon/api/key/

### 6. Release process

```
1. Bump version     →  node scripts/bump-version.js 1.2.0
2. Commit           →  git commit -m "chore(extension): bump to v1.2.0"
3. Tag              →  git tag extension-v1.2.0
4. Push             →  git push origin main --tags
5. CI triggers      →  deploy-extension.yml runs
6. Signed .xpi      →  uploaded to AMO + attached to GitHub Release
```

Decoupled from the main app deployment: tagging `extension-v*` deploys only the extension, not the web app. The existing `deploy-to-prod` job continues to deploy the web app on push to `main`.

### 7. Pre-submission checklist

Before the first AMO submission:

- [ ] Register a developer account at https://addons.mozilla.org/developers/
- [ ] Generate API credentials (JWT issuer + secret)
- [ ] Add `AMO_API_KEY` and `AMO_API_SECRET` to GitHub secrets
- [ ] Add a privacy policy URL to `manifest.json` (required if using `<all_urls>` permission)
- [ ] Write an AMO listing description (screenshots, feature summary)
- [ ] Decide on extension slug (URL-friendly name, e.g., `hutch-reading-list`)
- [ ] Review Mozilla's [add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

### 8. Future considerations

**Manifest v3 migration.** Firefox now supports Manifest v3. While v2 still works, migrating gives access to newer APIs and aligns with Chrome's direction. Key changes: `browser_action` → `action`, background scripts → background service worker, `menus` → included by default.

**Backend integration.** The extension currently uses in-memory providers. Once the Hutch web app has user auth and a reading list API, the extension should call those endpoints instead. This means:
- Add `host_permissions` for the API domain
- Replace `in-memory-auth.ts` / `in-memory-reading-list.ts` with HTTP providers
- The extension version with API integration should be deployed after the API is live

**Auto-update frequency.** AMO-listed extensions auto-update within 24 hours of a new version being approved. Mozilla reviews may take 1-5 days for the first submission, then are typically faster for updates.

**Source code submission.** Because the extension uses esbuild bundling, Mozilla reviewers may request the source code for manual review. Keep the build reproducible — pin all dependency versions in the lockfile.
