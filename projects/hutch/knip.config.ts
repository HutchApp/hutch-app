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
		// Workspace dependency for S3 config (subpath import not detected by knip)
		"firefox-extension",
		// Used in infra code (compiled separately)
		"hutch-logger",
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
