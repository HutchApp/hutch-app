import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [
		...(baseConfig.ignore || []),
		// PurgeCSS config loaded via CLI, not imported in source
		"purgecss.config.js",
	],
	ignoreDependencies: [
		...(baseConfig.ignoreDependencies || []),
		// Used via CLI in dev script
		"livereload",
		// Workspace dependencies with subpath imports not detected by knip
		"browser-extension-core",
		"save-link",
		// Used in app.ts (reached via infra entry point which knip ignores)
		"@packages/hutch-infra-components",
		// Used by scripts/check-unused-css.js (not a source-level import)
		"@packages/check-unused-css",
		// knip doesn't resolve workspace subpath for @packages/article-unique-id
		"@packages/article-unique-id",
	],
	ignoreBinaries: [
		...(baseConfig.ignoreBinaries || []),
		// Used via deploy script, installed globally or via npx
		"pulumi",
	],
	// Jest runs pre-compiled JS from dist/ but test sources are in src/
	jest: {
		entry: ["src/**/*.test.ts"],
	},
	playwright: {
		config: ["playwright.config.local-dev.ts"],
		entry: ["src/e2e/**/*.e2e-local.ts", "src/e2e/e2e-server.ts"],
	},
} satisfies KnipConfig;
