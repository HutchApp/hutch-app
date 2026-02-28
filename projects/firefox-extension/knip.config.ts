import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	ignore: [...(base.ignore ?? [])],
	ignoreDependencies: [
		// Used via c8 CLI wrapper in test-with-coverage script
		"c8",
	],
	entry: [
		// Extension entry points compiled by esbuild (scripts/build-extension.js)
		"src/background/background.ts",
		"src/popup/popup.ts",
	],
} satisfies KnipConfig;
