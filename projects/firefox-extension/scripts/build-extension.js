const { join } = require('node:path');
const { initBuildExtension } = require('browser-extension-core/build');
const config = require('../build-extension.config.js');

const { createBuildPlan } = initBuildExtension();

const plan = createBuildPlan({
  config,
  projectDir: join(__dirname, '..'),
  serverUrl: process.env.HUTCH_SERVER_URL,
});

plan.buildExtension().catch((err) => {
  console.error(err);
  process.exit(1);
});
