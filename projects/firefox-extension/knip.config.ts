import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [],
	ignoreDependencies: [],
	entry: [
		// Extension entry points compiled by esbuild (scripts/build-extension.js)
		"src/background/background.ts",
		"src/popup/popup.ts",
	],
} satisfies KnipConfig;
