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
} satisfies KnipConfig;
