import type { KnipConfig } from "knip";

export default {
	entry: [
		// Library entry point — published as `main`/`types` in package.json
		// (dist/index.js). Listed explicitly because knip's package.json
		// detection doesn't back-resolve dist/index.js to src/index.ts.
		"src/index.ts",
	],
	ignoreDependencies: [
		// knip doesn't resolve workspace subpath for @packages/* imports
		// (consistent with the workaround in @packages/crawl-article)
		"@packages/article-resource-unique-id",
		"@packages/article-state-types",
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
