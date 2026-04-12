import type { KnipConfig } from "knip";

export default {
	entry: [
		// Real-network canary invoked by the nx `check-sources` target and the crawler-health workflow
		"scripts/check-sources.js",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
