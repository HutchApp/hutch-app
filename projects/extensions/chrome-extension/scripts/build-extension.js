const { join } = require('node:path');
const { execSync } = require('node:child_process');
const { cpSync, mkdirSync, readFileSync } = require('node:fs');
const { initBuildExtension, extractAppDomainsFromPulumiYaml } = require('browser-extension-core/build');
const { build } = require('esbuild');
const config = require('../build-extension.config.js');

const projectDir = join(__dirname, '..');
const serverUrl = process.env.HUTCH_SERVER_URL;
const gitHash = execSync('git rev-parse --short=6 HEAD').toString().trim();
const isDev = serverUrl && serverUrl.includes('127.0.0.1');
const filename = isDev ? `hutch-${gitHash}-dev.zip` : `hutch-${gitHash}.zip`;

const hutchProjectDir = join(projectDir, '..', '..', 'hutch');
const stacks = ['Pulumi.prod.yaml', 'Pulumi.staging.yaml'];
const appDomains = Array.from(
  new Set(
    stacks.flatMap((file) =>
      extractAppDomainsFromPulumiYaml(readFileSync(join(hutchProjectDir, file), 'utf-8')),
    ),
  ),
);

const { createBuildPlan } = initBuildExtension();

const plan = createBuildPlan({
  config,
  projectDir,
  serverUrl,
  appDomains,
  pack: ({ sourceDir, outputPath }) => {
    execSync(`zip -r ${JSON.stringify(outputPath)} .`, {
      cwd: sourceDir,
      stdio: 'inherit',
    });
  },
});

(async () => {
  await plan.buildExtension();

  const srcDir = join(projectDir, 'src');
  const outDir = join(projectDir, 'dist-extension-compiled');

  // Chrome MV3 service workers can't use Canvas — offscreen document provides DOM access for icon tinting
  mkdirSync(join(outDir, 'offscreen'), { recursive: true });

  await build({
    entryPoints: [join(srcDir, 'runtime', 'offscreen', 'offscreen.browser.ts')],
    bundle: true,
    format: 'iife',
    outdir: outDir,
    outbase: join(srcDir, 'runtime'),
    target: config.target,
    define: {
      __SERVER_URL__: JSON.stringify(serverUrl),
      __APP_DOMAINS__: JSON.stringify(appDomains),
    },
  });

  cpSync(
    join(srcDir, 'runtime', 'offscreen', 'offscreen.html'),
    join(outDir, 'offscreen', 'offscreen.html'),
  );

  console.log('Chrome extension built (including offscreen document)');

  plan.packExtension(filename);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
