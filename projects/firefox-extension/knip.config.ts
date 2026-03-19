import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	ignore: [
		...(base.ignore ?? []),
		// Pulumi infra is compiled separately with its own tsconfig
		"src/infra/**",
		// CLI scripts (not entry points)
		"scripts/bump-version.js",
		"scripts/sync-signed-extension.js",
	],
	ignoreDependencies: [
		...(base.ignoreDependencies ?? []),
		// Used via c8 CLI wrapper in test-with-coverage script
		"c8",
		// Used by Pulumi infra (compiled separately)
		"@pulumi/aws",
		"@pulumi/pulumi",
		// Used via compile and ext:run scripts
		"web-ext",
		// Workspace dependencies — knip can't trace through esbuild-bundled entry points
		"browser-extension-core",
		"@packages/hutch-logger",
		// Dynamic import in E2E test — knip can't trace dynamic imports
		"@packages/hutch-test-app",
		// Used by scripts/check-unused-css.js (not a source-level import)
		"@packages/check-unused-css",
		// Used via scripts/run-tests-with-coverage.js (not a source import)
		"@packages/test-phase-runner",
	],
	ignoreBinaries: [
		...(base.ignoreBinaries ?? []),
		// Used via check-infra script
		"pulumi",
		// Used via compile and ext:run scripts
		"web-ext",
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
