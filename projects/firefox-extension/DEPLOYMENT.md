# Firefox Extension Deployment Strategy

## Current State

- Extension: **Hutch** — a reading list saver for Firefox
- Manifest: v2, targeting Firefox 91+
- Build: esbuild bundles to `dist-extension/` via `pnpm dist:extension`
- Data: in-memory providers (no backend integration yet)
- CI: `pnpm check` runs lint, tests, and `check-infra` to validate Pulumi configuration

## Distribution Channel (v1)

### Self-Hosted via S3

For v1, the extension is distributed from an S3 bucket as an unsigned `.xpi` file. Users download from the website's `/install` page and install manually via Firefox's developer mode.

**Advantages:**
- Decoupled from web app deployment (separate infrastructure)
- Simple CI/CD pipeline with standard nx targets
- CDN-ready if needed (S3 + CloudFront)

**Limitation:** Unsigned extensions require Firefox Developer Edition/Nightly, or setting `xpinstall.signatures.required` to `false` in `about:config`. This is acceptable for early adopters and internal testing.

## Implementation Plan

### 1. Add `web-ext` tooling

Mozilla's [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) CLI handles packaging and running extensions.

```bash
pnpm add --save-dev web-ext --filter firefox-extension
```

### 2. Update scripts to use standard nx targets

Update `package.json` to align with nx conventions. The standard `compile` target builds AND packages the extension. Only Firefox-specific commands like `ext:run` are custom.

```json
{
  "scripts": {
    "compile": "node scripts/build-extension.js && web-ext build --source-dir dist-extension --artifacts-dir dist-artifacts --overwrite-dest --filename hutch.xpi",
    "ext:run": "web-ext run --source-dir dist-extension"
  }
}
```

**Note:** The existing `lint` script already uses standard tooling (biome, tsc, knip) and is compatible with `nx lint` and `pnpm lint`. No changes needed.

### 3. Pulumi infrastructure (already implemented)

Infrastructure is in `projects/firefox-extension/infra/` to manage the S3 bucket. The following files are already in the repository:

- **`Pulumi.yaml`** — Project configuration
- **`Pulumi.prod.yaml`** — Production stack configuration (stage: prod)
- **`index.ts`** — S3 bucket and object upload
- **`tsconfig.json`** — TypeScript configuration for Pulumi

**`projects/firefox-extension/infra/index.ts`** (already in repository):

The infra code creates an S3 bucket with public read access and uploads the extension `.xpi` file. Key features:
- Conditionally uploads the xpi file only if it exists (allows `check-infra` to pass without compiled artifacts)
- Uses `forceDestroy: true` on the bucket for easy cleanup during development
- Exports `downloadUrl` for use in the website

See the actual implementation in `infra/index.ts`.

### 4. Version management

Keep `manifest.json` version and `package.json` version in sync. Use the bump-version script:

```bash
node scripts/bump-version.js 1.2.0
```

The script (`scripts/bump-version.js`) validates the version format (MAJOR.MINOR.PATCH), then updates both `package.json` and `src/runtime/manifest.json` atomically.

### 5. CI pipeline changes

The `pnpm check` command validates all aspects of the extension, including infrastructure:

```json
{
  "scripts": {
    "check-infra": "cd infra && PULUMI_CONFIG_PASSPHRASE='' pulumi preview --stack prod",
    "check": "pnpm lint && pnpm test-with-coverage && pnpm check-infra"
  }
}
```

This mirrors the pattern used in the hutch web app where `check` includes `check-infra` to verify Pulumi configuration is valid.

The CI job can validate builds by running compile:

```yaml
# Inside the existing check job, after pnpm check:
- name: Build and package extension
  run: pnpm --filter firefox-extension compile
```

### 6. Deployment workflow

Add a new job to deploy the extension to S3. This runs independently of the web app deployment:

```yaml
deploy-extension:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  needs: check
  runs-on: ubuntu-latest
  environment: prod
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AWS_REGION: ap-southeast-2
    PULUMI_BACKEND_URL: s3://hutch-pulumi-state-278728209435-ap-southeast-2
    PULUMI_CONFIG_PASSPHRASE: ''
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

    - name: Build and package extension
      run: pnpm --filter firefox-extension compile

    - name: Deploy extension to S3
      run: pulumi up --stack prod --yes
      working-directory: projects/firefox-extension/infra
```

### 7. Website integration

The existing `/install` route on hutch-app.com serves the extension download page. Update it to include a download button that links to the S3 URL:

```html
<a href="https://hutch-extension-prod.s3.ap-southeast-2.amazonaws.com/hutch.xpi"
   class="download-button">
  Download Hutch for Firefox
</a>
```

**Note:** The only coupling between the web app and extension is this S3 URL. The infrastructure lives entirely in `firefox-extension/infra`.

### 8. Release process

```
1. Bump version     →  node scripts/bump-version.js 1.2.0
2. Commit           →  git commit -m "chore(extension): bump to v1.2.0"
3. Push to main     →  git push origin main
4. CI triggers      →  deploy-extension job runs
5. Extension live   →  available at S3 URL
```

### 9. Installation instructions

Document these steps on the website's `/install` page:

1. Download `hutch.xpi` from the download button
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
