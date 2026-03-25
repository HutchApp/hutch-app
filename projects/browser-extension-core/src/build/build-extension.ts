import assert from "node:assert";
import { cpSync as defaultCpSync, mkdirSync as defaultMkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { build } from "esbuild";

export interface ExtensionBuildConfig {
	target: string;
}

interface EsbuildOptions {
	entryPoints: string[];
	bundle: boolean;
	format: "iife";
	outdir: string;
	outbase: string;
	target: string;
	alias: Record<string, string>;
	define: Record<string, string>;
}

interface CopyOperation {
	src: string;
	dest: string;
	recursive: boolean;
}

interface BuildExtensionDeps {
	esbuild: (options: EsbuildOptions) => Promise<unknown>;
	mkdirSync: (path: string, options: { recursive: true }) => void;
	cpSync: (src: string, dest: string, options?: { recursive?: boolean; force?: boolean }) => void;
	resolveCorePackageJson: () => string;
}

interface BuildPlanInput {
	config: ExtensionBuildConfig;
	projectDir: string;
	serverUrl: string | undefined;
	pack?: (params: { sourceDir: string; outputPath: string }) => void;
}

function createPlanData(input: { config: ExtensionBuildConfig; projectDir: string; serverUrl: string; corePackageJsonPath: string }): {
	esbuildOptions: EsbuildOptions;
	copies: CopyOperation[];
	directories: string[];
} {
	const srcDir = join(input.projectDir, "src");
	const outDir = join(input.projectDir, "dist-extension-compiled");
	const coreDir = dirname(input.corePackageJsonPath);

	const directories = [
		outDir,
		join(outDir, "popup"),
		join(outDir, "background"),
		join(outDir, "content"),
		join(outDir, "icons"),
		join(outDir, "icons-saved"),
	];

	const esbuildOptions: EsbuildOptions = {
		entryPoints: [
			join(srcDir, "runtime", "background", "background.ts"),
			join(srcDir, "runtime", "popup", "popup.ts"),
			join(srcDir, "runtime", "content", "shortcut.ts"),
		],
		bundle: true,
		format: "iife",
		outdir: outDir,
		outbase: join(srcDir, "runtime"),
		target: input.config.target,
		alias: {
			"browser-extension-core": join(coreDir, "src", "index.ts"),
		},
		define: {
			__SERVER_URL__: JSON.stringify(input.serverUrl),
		},
	};

	const copies: CopyOperation[] = [
		{ src: join(srcDir, "runtime", "manifest.json"), dest: join(outDir, "manifest.json"), recursive: false },
		{ src: join(srcDir, "runtime", "popup", "popup.template.html"), dest: join(outDir, "popup", "popup.template.html"), recursive: false },
		{ src: join(coreDir, "src", "popup", "popup.styles.css"), dest: join(outDir, "popup", "popup.styles.css"), recursive: false },
		{ src: join(srcDir, "icons"), dest: join(outDir, "icons"), recursive: true },
		{ src: join(srcDir, "icons-saved"), dest: join(outDir, "icons-saved"), recursive: true },
	];

	return { esbuildOptions, copies, directories };
}

export function initBuildExtension(deps: Partial<BuildExtensionDeps> = {}) {
	const resolvedDeps: BuildExtensionDeps = {
		esbuild: deps.esbuild ?? build,
		mkdirSync: deps.mkdirSync ?? defaultMkdirSync,
		cpSync: deps.cpSync ?? defaultCpSync,
		resolveCorePackageJson: deps.resolveCorePackageJson ?? (() => join(__dirname, "..", "..", "package.json")),
	};

	return {
		createBuildPlan(input: BuildPlanInput) {
			assert(input.serverUrl, "HUTCH_SERVER_URL environment variable is required.\nSet it before building (e.g. HUTCH_SERVER_URL=https://hutch-app.com)");

			const planData = createPlanData({
				config: input.config,
				projectDir: input.projectDir,
				serverUrl: input.serverUrl,
				corePackageJsonPath: resolvedDeps.resolveCorePackageJson(),
			});

			return {
				...planData,
				async buildExtension(): Promise<void> {
					for (const dir of planData.directories) {
						resolvedDeps.mkdirSync(dir, { recursive: true });
					}

					await resolvedDeps.esbuild(planData.esbuildOptions);

					for (const copy of planData.copies) {
						if (copy.recursive) {
							resolvedDeps.cpSync(copy.src, copy.dest, { recursive: true, force: true });
						} else {
							resolvedDeps.cpSync(copy.src, copy.dest, { force: true });
						}
					}

					console.log("Extension built to dist-extension-compiled/");
				},
				packExtension(filename: string): void {
					assert(input.pack, "pack callback is required — provide it in createBuildPlan input");
					const sourceDir = join(input.projectDir, "dist-extension-compiled");
					const artifactsDir = join(input.projectDir, "dist-extension-files");
					resolvedDeps.mkdirSync(artifactsDir, { recursive: true });
					input.pack({ sourceDir, outputPath: join(artifactsDir, filename) });
					console.log(`Extension packed to dist-extension-files/${filename}`);
				},
			};
		},
	};
}
