import type { KnipConfig } from "knip";

export default {
	entry: [
		// Canary entrypoint invoked by the nx `check-stuck-articles` target and
		// the stuck-articles-canary workflow. Compiled to
		// dist/scripts/check-stuck-articles.js and run with `node --test`.
		// Requires the exclude patterns table (exclude-patterns.ts) as a direct import.
		"scripts/check-stuck-articles.ts",
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
