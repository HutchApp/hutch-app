import { initBumpVersion, parseBumpType } from "./bump-version";

describe("parseBumpType", () => {
	it("parses patch", () => {
		expect(parseBumpType("patch")).toBe("patch");
	});

	it("parses minor", () => {
		expect(parseBumpType("minor")).toBe("minor");
	});

	it("parses major", () => {
		expect(parseBumpType("major")).toBe("major");
	});

	it("rejects invalid string input", () => {
		expect(() => parseBumpType("invalid")).toThrow("Invalid argument: invalid");
	});

	it("rejects numeric input that the old script accepted", () => {
		expect(() => parseBumpType("42")).toThrow("Invalid argument: 42");
	});
});

describe("initBumpVersion", () => {
	function createInMemoryDeps(files: Record<string, string>) {
		return {
			readFile: (path: string) => files[path],
			writeFile: (path: string, content: string) => {
				files[path] = content;
			},
		};
	}

	function makeFiles(version: string) {
		return {
			"package.json": JSON.stringify({ name: "test-ext", version }),
			"manifest.json": JSON.stringify({ name: "Test Extension", version }),
		};
	}

	it("bumps patch version", () => {
		const files = makeFiles("1.0.1");
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		const result = bumpVersion({
			bumpType: "patch",
			packageJsonPath: "package.json",
			manifestPath: "manifest.json",
		});

		expect(result).toEqual({ oldVersion: "1.0.1", newVersion: "1.0.2" });
		expect(JSON.parse(files["package.json"]).version).toBe("1.0.2");
		expect(JSON.parse(files["manifest.json"]).version).toBe("1.0.2");
	});

	it("bumps minor version and resets patch", () => {
		const files = makeFiles("1.0.5");
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		const result = bumpVersion({
			bumpType: "minor",
			packageJsonPath: "package.json",
			manifestPath: "manifest.json",
		});

		expect(result).toEqual({ oldVersion: "1.0.5", newVersion: "1.1.0" });
	});

	it("bumps major version and resets minor and patch", () => {
		const files = makeFiles("1.2.3");
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		const result = bumpVersion({
			bumpType: "major",
			packageJsonPath: "package.json",
			manifestPath: "manifest.json",
		});

		expect(result).toEqual({ oldVersion: "1.2.3", newVersion: "2.0.0" });
	});

	it("throws for invalid semver in package.json", () => {
		const files = makeFiles("not-a-version");
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		expect(() =>
			bumpVersion({
				bumpType: "patch",
				packageJsonPath: "package.json",
				manifestPath: "manifest.json",
			}),
		).toThrow("Current version is not valid semver: not-a-version");
	});

	it("writes formatted JSON with trailing newline", () => {
		const files = makeFiles("1.0.0");
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		bumpVersion({
			bumpType: "patch",
			packageJsonPath: "package.json",
			manifestPath: "manifest.json",
		});

		expect(files["package.json"].endsWith("\n")).toBe(true);
		expect(files["manifest.json"].endsWith("\n")).toBe(true);
	});

	it("preserves other fields in package.json and manifest.json", () => {
		const files = {
			"package.json": JSON.stringify({ name: "my-ext", version: "2.0.0", private: true }),
			"manifest.json": JSON.stringify({ manifest_version: 2, name: "My Ext", version: "2.0.0" }),
		};
		const bumpVersion = initBumpVersion(createInMemoryDeps(files));

		bumpVersion({
			bumpType: "patch",
			packageJsonPath: "package.json",
			manifestPath: "manifest.json",
		});

		const pkg = JSON.parse(files["package.json"]);
		expect(pkg.name).toBe("my-ext");
		expect(pkg.private).toBe(true);
		expect(pkg.version).toBe("2.0.1");

		const manifest = JSON.parse(files["manifest.json"]);
		expect(manifest.manifest_version).toBe(2);
		expect(manifest.name).toBe("My Ext");
		expect(manifest.version).toBe("2.0.1");
	});
});
