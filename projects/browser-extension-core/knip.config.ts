import type { KnipConfig } from "knip";

export default {
	entry: [
		"src/e2e/index.ts",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
	ignoreDependencies: [
		// Type-only import from hutch-logger — knip doesn't trace type imports as usage
		"@packages/hutch-logger",
	],
} satisfies KnipConfig;
