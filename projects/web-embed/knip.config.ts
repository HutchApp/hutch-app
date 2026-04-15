import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignoreDependencies: [
		...(baseConfig.ignoreDependencies || []),
		// knip doesn't resolve workspace subpath for @packages/* imports
		"@packages/hutch-infra-components",
		// @pulumi/aws types are referenced transitively via hutch-infra-components
		"@pulumi/aws",
	],
	ignoreBinaries: [
		...(baseConfig.ignoreBinaries || []),
		// Used via deploy-infra script, installed globally or via npx
		"pulumi",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
	playwright: {
		config: ["playwright.config.local-dev.ts"],
		entry: ["src/e2e/**/*.e2e-local.ts", "src/e2e/e2e-server.main.ts"],
	},
} satisfies KnipConfig;
