import type { KnipConfig } from "knip";

export default {
	ignoreDependencies: [
		"c8",
	],
	ignoreBinaries: [
		"knip",
		"biome",
		"nx",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
