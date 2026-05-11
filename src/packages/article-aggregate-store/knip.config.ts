import type { KnipConfig } from "knip";

export default {
	ignoreDependencies: [
		// knip doesn't resolve workspace subpath for @packages/* imports
		"@packages/article-resource-unique-id",
		"@packages/article-state-types",
		"@packages/domain",
		"@packages/hutch-infra-components",
		"@packages/hutch-logger",
		"@packages/hutch-storage-client",
	],
	ignoreBinaries: ["knip", "biome", "nx"],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
