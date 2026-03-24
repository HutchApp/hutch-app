import assert from "node:assert";
import { inc, valid } from "semver";

type BumpType = "patch" | "minor" | "major";

interface BumpVersionDeps {
	readFile: (path: string) => string;
	writeFile: (args: { path: string; content: string }) => void;
}

const BUMP_TYPES: Record<string, BumpType> = {
	patch: "patch",
	minor: "minor",
	major: "major",
};

export function parseBumpType(arg: string): BumpType {
	const bumpType = BUMP_TYPES[arg];
	if (bumpType) {
		return bumpType;
	}
	throw new Error(
		`Invalid argument: ${arg}\n` +
			"Usage: bump-version [patch|minor|major]\n" +
			"  patch - increment patch version (default)\n" +
			"  minor - increment minor version, reset patch to 0\n" +
			"  major - increment major version, reset minor and patch to 0",
	);
}

export function initBumpVersion(deps: BumpVersionDeps) {
	return function bumpVersion(input: {
		bumpType: BumpType;
		packageJsonPath: string;
		manifestPath: string;
	}): { oldVersion: string; newVersion: string } {
		const packageJson = JSON.parse(deps.readFile(input.packageJsonPath));
		const manifest = JSON.parse(deps.readFile(input.manifestPath));
		const oldVersion: string = packageJson.version;

		assert(valid(oldVersion), `Current version is not valid semver: ${oldVersion}`);

		const newVersion = inc(oldVersion, input.bumpType);
		assert(newVersion, `Failed to increment version ${oldVersion} with ${input.bumpType}`);

		packageJson.version = newVersion;
		manifest.version = newVersion;

		deps.writeFile({ path: input.packageJsonPath, content: `${JSON.stringify(packageJson, null, 2)}\n` });
		deps.writeFile({ path: input.manifestPath, content: `${JSON.stringify(manifest, null, 2)}\n` });

		return { oldVersion, newVersion };
	};
}
