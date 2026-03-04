# Firefox Extension Deployment Strategy

## Current State

- Extension: **Hutch** — a reading list saver for Firefox
- Manifest: v2, targeting Firefox 91+
- Build: esbuild bundles to `dist-extension/` via `pnpm dist:extension`
- Data: in-memory providers (no backend integration yet)
- CI: `pnpm check` runs lint + tests, but no extension-specific distribution step

## Distribution Channel (v1)

### Self-Hosted via Website Download

For v1, the extension is distributed directly from the Hutch website as an unsigned `.xpi` file. Users download and install manually via Firefox's developer mode.

**Advantages:**
- No external dependencies (Mozilla account, API credentials)
- Immediate deployment on every release
- Simple CI/CD pipeline

**Limitation:** Unsigned extensions require Firefox Developer Edition/Nightly, or setting `xpinstall.signatures.required` to `false` in `about:config`. This is acceptable for early adopters and internal testing.

## Implementation Plan

### 1. Add `web-ext` tooling

Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) CLI handles packaging, linting, and running extensions.

```bash
pnpm add --save-dev web-ext --filter firefox-extension
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "ext:build": "node scripts/build-extension.js",
    "ext:lint": "web-ext lint --source-dir dist-extension",
    "ext:package": "web-ext build --source-dir dist-extension --artifacts-dir dist-artifacts --overwrite-dest --filename hutch.xpi",
    "ext:run": "web-ext run --source-dir dist-extension"
  }
}
```

### 2. Version management

Keep `manifest.json` version and `package.json` version in sync. Add a script to bump both:

```bash
# scripts/bump-version.js
# Reads new version from CLI arg, updates both manifest.json and package.json
```

### 3. Serve extension via web app

Add a static route to serve the extension from the Hutch website:

**Option A: Static file in `public/` directory**

Copy the built `.xpi` to `projects/hutch/src/runtime/public/downloads/` during deployment:

```bash
cp projects/firefox-extension/dist-artifacts/hutch.xpi projects/hutch/src/runtime/public/downloads/
```

The file is then available at `https://hutch.app/downloads/hutch.xpi`.

**Option B: Dedicated route (if download tracking is needed)**

Add a route in `server.ts`:

```typescript
app.get('/downloads/hutch.xpi', (req, res) => {
  const xpiPath = join(__dirname, 'public/downloads/hutch.xpi');
  res.download(xpiPath, 'hutch.xpi');
});
```

### 4. CI pipeline changes

Extend `.github/workflows/ci.yml` to build, lint, and package the extension:

```yaml
# Inside the existing check job, after pnpm install:
- name: Build extension
  run: pnpm --filter firefox-extension ext:build

- name: Lint extension
  run: pnpm --filter firefox-extension ext:lint

- name: Package extension
  run: pnpm --filter firefox-extension ext:package
```

### 5. Deployment workflow

Update the existing `deploy-to-prod` workflow to include extension deployment. The extension must be built and copied to the public directory **before** `pulumi up` runs, since Pulumi deploys the application including static assets:

```yaml
# Add BEFORE the pulumi up step:
- name: Build and package extension
  run: |
    pnpm --filter firefox-extension ext:build
    pnpm --filter firefox-extension ext:package

- name: Copy extension to public downloads
  run: |
    mkdir -p projects/hutch/src/runtime/public/downloads
    cp projects/firefox-extension/dist-artifacts/hutch.xpi projects/hutch/src/runtime/public/downloads/

# Existing step - extension is now included in deployed assets
- run: PULUMI_CONFIG_PASSPHRASE='' pulumi up --stack prod --yes
  working-directory: projects/hutch
```

The extension is deployed alongside the web app on every push to `main`.

### 6. Release process

```
1. Bump version     →  node scripts/bump-version.js 1.2.0
2. Commit           →  git commit -m "chore(extension): bump to v1.2.0"
3. Push to main     →  git push origin main
4. CI triggers      →  deploy-to-prod.yml runs
5. Extension live   →  available at /downloads/hutch.xpi
```

### 7. Installation instructions

Document these steps on the website's download page:

1. Download `hutch.xpi` from the website
2. In Firefox, navigate to `about:config`
3. Search for `xpinstall.signatures.required` and set to `false`
4. Navigate to `about:addons` → Extensions
5. Click the gear icon → "Install Add-on From File..."
6. Select the downloaded `hutch.xpi`

**Note:** Firefox Developer Edition and Nightly allow unsigned extension installation by default.

## Future Considerations (v2)

**AMO signing for mainstream Firefox.** To support regular Firefox users, submit to AMO (Mozilla Add-ons) for signing. This can be either:
- **Listed:** Public on addons.mozilla.org with discovery and auto-updates
- **Unlisted:** Signed by Mozilla but self-hosted, no public listing

**Manifest v3 migration.** Firefox now supports Manifest v3. Key changes: `browser_action` → `action`, background scripts → background service worker.

**Backend integration.** Once the Hutch web app has user auth and a reading list API, replace in-memory providers with HTTP providers that call the backend.
