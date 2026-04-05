import type { KnipConfig } from "knip";

export default {
	ignoreDependencies: [
		"c8",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
