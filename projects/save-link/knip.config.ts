import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	entry: [
		// Consumed by infra Lambda handlers (src/infra/** is ignored)
		"src/save-link/find-article-content.ts",
	],
	ignore: [
		...(base.ignore ?? []),
		"src/infra/**",
		// Used only from infra code (compiled separately by Lambda handler)
		"src/generate-summary/dynamodb-summary-cache.ts",
	],
	ignoreDependencies: [
		...(base.ignoreDependencies ?? []),
		// Used only in infra code (Lambda handlers, compiled separately)
		"@anthropic-ai/sdk",
		"openai",
		// Workspace dependencies with subpath imports not detected by knip
		"@packages/hutch-infra-components",
		"@packages/link-id",
		// Used only in infra code (Pulumi IaC, compiled separately)
		"@pulumi/aws",
	],
	ignoreBinaries: [
		...(base.ignoreBinaries ?? []),
		// Used via deploy script, installed globally or via npx
		"pulumi",
	],
	jest: {
		entry: ["src/**/*.test.ts"],
	},
} satisfies KnipConfig;
