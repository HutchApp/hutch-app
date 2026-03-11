import type { KnipConfig } from "knip";

export default {
	ignoreBinaries: [
		"knip",
		"biome",
	],
	ignoreDependencies: [
		// Type-only import from hutch-logger — knip doesn't trace type imports as usage
		"hutch-logger",
	],
} satisfies KnipConfig;
