import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

export default {
	...baseConfig,
	ignore: [
		// Test utilities used by integration tests
		"**/test-utils.ts",
	],
} satisfies KnipConfig;
