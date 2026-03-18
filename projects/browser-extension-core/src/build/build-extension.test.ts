import { join } from "node:path";
import { initBuildExtension } from "./build-extension";

describe("createBuildPlan", () => {
	const projectDir = "/projects/firefox-extension";
	const corePackageJsonPath = "/projects/browser-extension-core/package.json";

	function createBuildPlan(input: { config: { target: string }; projectDir: string; serverUrl: string }) {
		const { createBuildPlan } = initBuildExtension({
			resolveCorePackageJson: () => corePackageJsonPath,
		});
		return createBuildPlan(input);
	}

	it("sets esbuild target from config", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.target).toBe("firefox91");
	});

	it("uses a different target for chrome", () => {
		const plan = createBuildPlan({
			config: { target: "chrome109" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.target).toBe("chrome109");
	});

	it("bundles three entry points from src/runtime", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.entryPoints).toEqual([
			join(projectDir, "src", "runtime", "background", "background.ts"),
			join(projectDir, "src", "runtime", "popup", "popup.ts"),
			join(projectDir, "src", "runtime", "content", "shortcut.ts"),
		]);
	});

	it("outputs to dist-extension-compiled", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.outdir).toBe(join(projectDir, "dist-extension-compiled"));
	});

	it("uses iife format for browser extension scripts", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.format).toBe("iife");
		expect(plan.esbuildOptions.bundle).toBe(true);
	});

	it("aliases browser-extension-core to source for bundling", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.alias["browser-extension-core"]).toBe(
			join("/projects/browser-extension-core", "src", "index.ts"),
		);
	});

	it("defines __SERVER_URL__ as JSON string", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		expect(plan.esbuildOptions.define.__SERVER_URL__).toBe('"https://hutch-app.com"');
	});

	it("includes six output directories", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		const outDir = join(projectDir, "dist-extension-compiled");
		expect(plan.directories).toEqual([
			outDir,
			join(outDir, "popup"),
			join(outDir, "background"),
			join(outDir, "content"),
			join(outDir, "icons"),
			join(outDir, "icons-saved"),
		]);
	});

	it("copies manifest, popup files, and icon directories", () => {
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir,
			serverUrl: "https://hutch-app.com",
		});

		const srcDir = join(projectDir, "src");
		const outDir = join(projectDir, "dist-extension-compiled");

		expect(plan.copies).toEqual([
			{ src: join(srcDir, "runtime", "manifest.json"), dest: join(outDir, "manifest.json"), recursive: false },
			{ src: join(srcDir, "runtime", "popup", "popup.template.html"), dest: join(outDir, "popup", "popup.template.html"), recursive: false },
			{ src: join(srcDir, "runtime", "popup", "popup.styles.css"), dest: join(outDir, "popup", "popup.styles.css"), recursive: false },
			{ src: join(srcDir, "icons"), dest: join(outDir, "icons"), recursive: true },
			{ src: join(srcDir, "icons-saved"), dest: join(outDir, "icons-saved"), recursive: true },
		]);
	});
});

describe("initBuildExtension defaults", () => {
	it("resolves core package.json from module location by default", () => {
		const { createBuildPlan } = initBuildExtension();
		const plan = createBuildPlan({
			config: { target: "firefox91" },
			projectDir: "/test",
			serverUrl: "https://example.com",
		});

		expect(plan.esbuildOptions.alias["browser-extension-core"]).toContain("browser-extension-core");
	});
});

describe("initBuildExtension", () => {
	function createInMemoryDeps() {
		const createdDirs: Array<{ path: string; options: { recursive: true } }> = [];
		const copiedFiles: Array<{ src: string; dest: string; options?: { recursive: boolean } }> = [];
		let esbuildCallCount = 0;
		let lastEsbuildOptions: { target: string } | null = null;

		const deps = {
			esbuild: async (options: { target: string }) => {
				esbuildCallCount++;
				lastEsbuildOptions = options;
			},
			mkdirSync: (path: string, options: { recursive: true }) => {
				createdDirs.push({ path, options });
			},
			cpSync: (src: string, dest: string, options?: { recursive: boolean }) => {
				copiedFiles.push({ src, dest, options });
			},
			resolveCorePackageJson: () => "/projects/browser-extension-core/package.json",
		};

		return {
			deps,
			createdDirs,
			copiedFiles,
			getEsbuildCallCount: () => esbuildCallCount,
			getLastEsbuildOptions: () => lastEsbuildOptions,
		};
	}

	it("creates output directories before building", async () => {
		const { deps, createdDirs } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await buildExtension({
			config: { target: "firefox91" },
			projectDir: "/projects/firefox-extension",
			serverUrl: "https://hutch-app.com",
		});

		expect(createdDirs.length).toBe(6);
		expect(createdDirs[0].options).toEqual({ recursive: true });
	});

	it("calls esbuild with resolved options", async () => {
		const { deps, getEsbuildCallCount, getLastEsbuildOptions } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await buildExtension({
			config: { target: "chrome109" },
			projectDir: "/projects/chrome-extension",
			serverUrl: "https://hutch-app.com",
		});

		expect(getEsbuildCallCount()).toBe(1);
		expect(getLastEsbuildOptions()?.target).toBe("chrome109");
	});

	it("copies static files after esbuild completes", async () => {
		const { deps, copiedFiles } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await buildExtension({
			config: { target: "firefox91" },
			projectDir: "/projects/firefox-extension",
			serverUrl: "https://hutch-app.com",
		});

		expect(copiedFiles.length).toBe(5);
		expect(copiedFiles[0].dest).toContain("manifest.json");
	});

	it("passes recursive option for directory copies", async () => {
		const { deps, copiedFiles } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await buildExtension({
			config: { target: "firefox91" },
			projectDir: "/projects/firefox-extension",
			serverUrl: "https://hutch-app.com",
		});

		const iconsCopy = copiedFiles.find((c) => c.dest.endsWith("icons") && !c.dest.endsWith("icons-saved"));
		expect(iconsCopy?.options).toEqual({ recursive: true });

		const manifestCopy = copiedFiles.find((c) => c.dest.endsWith("manifest.json"));
		expect(manifestCopy?.options).toBeUndefined();
	});

	it("throws when serverUrl is empty", async () => {
		const { deps } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await expect(
			buildExtension({
				config: { target: "firefox91" },
				projectDir: "/projects/firefox-extension",
				serverUrl: "",
			}),
		).rejects.toThrow("HUTCH_SERVER_URL");
	});

	it("throws when serverUrl is undefined", async () => {
		const { deps } = createInMemoryDeps();
		const { buildExtension } = initBuildExtension(deps);

		await expect(
			buildExtension({
				config: { target: "firefox91" },
				projectDir: "/projects/firefox-extension",
				serverUrl: undefined,
			}),
		).rejects.toThrow("HUTCH_SERVER_URL");
	});
});
