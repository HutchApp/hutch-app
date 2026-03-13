import assert from "node:assert";
import { inc, valid } from "semver";

type BumpType = "patch" | "minor" | "major";

interface BumpVersionDeps {
	readFile: (path: string) => string;
	writeFile: (path: string, content: string) => void;
}

export function parseBumpType(arg: string): BumpType {
	const validTypes: BumpType[] = ["patch", "minor", "major"];
	if (validTypes.includes(arg as BumpType)) {
		return arg as BumpType;
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

		deps.writeFile(input.packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
		deps.writeFile(input.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

		return { oldVersion, newVersion };
	};
}
