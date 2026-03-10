import type { KnipConfig } from "knip";

export default {
	ignoreDependencies: [
		// Workspace dependency — type-only import not detected as runtime usage
		"hutch-logger",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
} satisfies KnipConfig;
