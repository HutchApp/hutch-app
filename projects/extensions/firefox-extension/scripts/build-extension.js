const { join, basename, dirname } = require('node:path');
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { initBuildExtension, extractAppDomainsFromPulumiYaml } = require('browser-extension-core/build');
const config = require('../build-extension.config.js');

const projectDir = join(__dirname, '..');
const serverUrl = process.env.HUTCH_SERVER_URL;
const gitHash = execSync('git rev-parse --short=6 HEAD').toString().trim();
const isDev = serverUrl && serverUrl.includes('127.0.0.1');
const filename = isDev ? `hutch-${gitHash}-dev.xpi` : `hutch-${gitHash}.xpi`;

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
    execSync(`web-ext build --source-dir ${sourceDir} --artifacts-dir ${dirname(outputPath)} --overwrite-dest --filename ${basename(outputPath)}`, {
      cwd: projectDir,
      stdio: 'inherit',
    });
  },
});

(async () => {
  await plan.buildExtension();
  plan.packExtension(filename);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
