import type { KnipConfig } from "knip";

export default {
	entry: [],
	ignore: [
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreBinaries: [
		"knip",
		"biome",
		// Used via check script to delegate to Nx
		"nx",
	],
	ignoreDependencies: [
		// Type-only import from hutch-logger — knip doesn't trace type imports as usage
		"@packages/hutch-logger",
		// Used via scripts/run-tests-with-coverage.js (not a source import)
		"@packages/test-phase-runner",
		// Used by scripts/check-unused-css.js (not a source-level import)
		"@packages/check-unused-css",
	],
} satisfies KnipConfig;
