import baseConfig from "../../knip.config.base";
import type { KnipConfig } from "knip";

const { workspaces: _workspaces, ...base } = baseConfig;

export default {
	...base,
	entry: [
		"src/**/*.ts",
		"!src/**/*.test.ts",
	],
} satisfies KnipConfig;
