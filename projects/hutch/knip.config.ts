import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [...(baseConfig.ignore || []), "src/infra/**"],
	ignoreDependencies: [
		...(baseConfig.ignoreDependencies || []),
		// Deployment infra runs outside the main build (Lambda handler + Pulumi IaC)
		"serverless-http",
		"@pulumi/pulumi",
		"@pulumi/aws",
		"@types/aws-lambda",
		"helmet",
		"compression",
		"@types/compression",
		// Workspace dependencies with subpath imports not detected by knip
		"browser-extension-core",
		"save-link",
		// Used in app.ts (reached via infra entry point which knip ignores)
		"@packages/hutch-infra-components",
		// Used by scripts/check-unused-css.js (not a source-level import)
		"@packages/check-unused-css",
		// Used in normalize-article-url.ts (knip doesn't resolve workspace subpath)
		"@packages/link-id",
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
