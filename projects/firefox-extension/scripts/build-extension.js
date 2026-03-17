const { build } = require('esbuild');
const { cpSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { initBuildExtension } = require('browser-extension-core/build');
const config = require('../build-extension.config.js');

const buildExtension = initBuildExtension({
  esbuild: build,
  mkdirSync,
  cpSync,
  resolveCorePackageJson: () => require.resolve('browser-extension-core/package.json'),
});

buildExtension({
  config,
  projectDir: join(__dirname, '..'),
  serverUrl: process.env.HUTCH_SERVER_URL || '',
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
