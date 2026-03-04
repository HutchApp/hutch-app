# Firefox Extension Deployment Strategy

## Current State

- Extension: **Hutch** — a reading list saver for Firefox
- Manifest: v2, targeting Firefox 91+
- Build: esbuild bundles to `dist-extension/` via `pnpm dist:extension`
- Data: in-memory providers (no backend integration yet)
- CI: `pnpm check` runs lint + tests, but no extension-specific distribution step

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

### 3. Create Pulumi infrastructure

Create infrastructure in `projects/firefox-extension/infra/` to manage the S3 bucket:

**`projects/firefox-extension/Pulumi.yaml`:**
```yaml
name: firefox-extension
runtime:
  name: nodejs
  options:
    typescript: true
```

**`projects/firefox-extension/Pulumi.prod.yaml`:**
```yaml
config:
  firefox-extension:stage: prod
```

**`projects/firefox-extension/infra/index.ts`:**
```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = new pulumi.Config();
const stage = config.require("stage");

const bucket = new aws.s3.Bucket("hutch-extension", {
  bucket: `hutch-extension-${stage}`,
  forceDestroy: true,
});

new aws.s3.BucketPublicAccessBlock("hutch-extension-public-access", {
  bucket: bucket.id,
  blockPublicAcls: false,
  blockPublicPolicy: false,
  ignorePublicAcls: false,
  restrictPublicBuckets: false,
});

const bucketPolicy = new aws.s3.BucketPolicy("hutch-extension-policy", {
  bucket: bucket.id,
  policy: bucket.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `${arn}/*`,
        },
      ],
    }),
  ),
});

const xpiPath = join(__dirname, "..", "dist-artifacts", "hutch.xpi");
const extensionObject = new aws.s3.BucketObject("hutch-xpi", {
  bucket: bucket.id,
  key: "hutch.xpi",
  source: new pulumi.asset.FileAsset(xpiPath),
  contentType: "application/x-xpinstall",
});

export const downloadUrl = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}/hutch.xpi`;
export const _dependencies = [bucketPolicy, extensionObject];
```

### 4. Version management

Keep `manifest.json` version and `package.json` version in sync. Add a script to bump both:

```bash
# scripts/bump-version.js
# Reads new version from CLI arg, updates both manifest.json and package.json
```

### 5. CI pipeline changes

The existing `pnpm check` already runs lint and tests via nx. Add extension compilation to the check job to validate builds:

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
      working-directory: projects/firefox-extension
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
