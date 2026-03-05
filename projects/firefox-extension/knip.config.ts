import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	ignore: [
		...(base.ignore ?? []),
		// Pulumi infra is compiled separately with its own tsconfig
		"infra/**",
		// CLI script for version management (not an entry point)
		"scripts/bump-version.js",
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
		// Exported for use by hutch web app (install page)
		"s3-config.js",
	],
} satisfies KnipConfig;
