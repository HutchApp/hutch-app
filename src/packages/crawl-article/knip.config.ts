import type { KnipConfig } from "knip";

export default {
	entry: [
		// Real-network canary invoked by the nx `tier-1-plus-pipeline-health` target
		// and the tier-1-plus-crawl-pipeline-health workflow. Requires the sources
		// table (health-sources.js) as a direct import dependency.
		"scripts/tier-1-plus-pipeline-health.js",
		"scripts/health-sources.js",
	],
	ignoreBinaries: [
		"knip",
		"biome",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
