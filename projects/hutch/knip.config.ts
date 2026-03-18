import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [
		"src/infra/**",
		// Integration test files are entry points for jest
		"**/*.integration.ts",
		// Test utilities used by integration tests
		"**/test-utils.ts",
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreDependencies: [
		// Used via CLI in dev script
		"livereload",
		// Workspace dependency for S3 config (subpath import not detected by knip)
		"firefox-extension",
		// Used in infra code (compiled separately)
		"@packages/hutch-logger",
		// tsconfig paths alias resolves at compile time; runtime requires the workspace package via node_modules
		"@packages/hutch-test-app",
	],
	ignoreBinaries: [
		...(baseConfig.ignoreBinaries || []),
		// Used via deploy script, installed globally or via npx
		"pulumi",
	],
	// Jest runs pre-compiled JS from dist/ but test sources are in src/
	jest: {
		entry: ["src/**/*.test.ts"],
	},
	playwright: {
		config: ["playwright.config.local-dev.ts"],
		entry: ["src/e2e/**/*.e2e-local.ts", "src/e2e/e2e-server.ts"],
	},
} satisfies KnipConfig;
