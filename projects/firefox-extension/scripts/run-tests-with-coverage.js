#!/usr/bin/env node
const { join } = require('node:path');
const { initTestPhaseRunner } = require('@packages/test-phase-runner');
const config = require('../run-tests.config.js');

const { createTestPlan } = initTestPhaseRunner();

const plan = createTestPlan({
  config,
  projectRoot: join(__dirname, '..'),
});

plan.runAllPhases().catch((error) => {
  console.error('Test run failed:', error.message);
  process.exit(1);
});
