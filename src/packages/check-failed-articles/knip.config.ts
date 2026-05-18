import type { KnipConfig } from "knip";

export default {
	entry: [
		"scripts/check-failed-articles.ts",
		"scripts/collect-failed-rows.ts",
		"scripts/exclude-patterns.ts",
	],
	ignoreDependencies: [
		// knip doesn't resolve workspace subpath for @packages/* imports
		// (consistent with the same workaround in projects/hutch and crawl-article)
		"@packages/article-state-types",
		"@packages/hutch-storage-client",
	],
	ignoreBinaries: ["knip", "biome"],
} satisfies KnipConfig;
