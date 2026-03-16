import type { KnipConfig } from "knip";

export default {
	ignore: [
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
		// Pulumi infra is compiled separately with its own tsconfig
		"src/infra/**",
		// esbuild output directory — not source code
		"dist-extension-compiled/**",
	],
	ignoreDependencies: [
		// Used via c8 CLI wrapper in test-with-coverage script
		"c8",
		// Used by Pulumi infra (compiled separately)
		"@pulumi/aws",
		"@pulumi/pulumi",
		// Workspace dependencies — knip can't trace through esbuild-bundled entry points
		"browser-extension-core",
		"hutch-logger",
		// Playwright used in E2E tests via node --test runner
		"playwright",
		// Used via CLI script, not imported in source
		"purgecss",
	],
	ignoreBinaries: [
		// Installed at root level in monorepo
		"knip",
		"biome",
		// Used via check-infra script
		"pulumi",
	],
	entry: [
		// Extension entry points compiled by esbuild (scripts/build-extension.js)
		"src/runtime/background/background.ts",
		"src/runtime/popup/popup.ts",
		"src/runtime/content/shortcut.ts",
		// E2E test entry points (run via node --test)
		"src/e2e/**/run.e2e-local.ts",
		// Exported for use by hutch web app (install page)
		"s3-config.js",
	],
} satisfies KnipConfig;
