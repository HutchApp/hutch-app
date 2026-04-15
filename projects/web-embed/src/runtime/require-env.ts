import assert from "node:assert";

// V8 coverage: const + arrow avoids function declaration counting quirks — see https://github.com/jestjs/jest/issues/11188
export const requireEnv = (name: string): string => {
	const value = process.env[name];
	assert.ok(value !== undefined, `Environment variable ${name} is required but not set`);
	return value;
};
