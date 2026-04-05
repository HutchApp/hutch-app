import type { KnipConfig } from "knip";

export default {
	ignoreDependencies: [
		// Type definitions for Lambda handler signatures
		"@types/aws-lambda",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
} satisfies KnipConfig;
