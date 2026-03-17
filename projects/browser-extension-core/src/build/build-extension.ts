import assert from "node:assert";
import { join, dirname } from "node:path";

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
	cpSync: (src: string, dest: string, options?: { recursive: boolean }) => void;
	resolveCorePackageJson: () => string;
}

export function createBuildPlan(input: {
	config: ExtensionBuildConfig;
	projectDir: string;
	serverUrl: string;
	corePackageJsonPath: string;
}): { esbuildOptions: EsbuildOptions; copies: CopyOperation[]; directories: string[] } {
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
		{ src: join(srcDir, "runtime", "popup", "popup.styles.css"), dest: join(outDir, "popup", "popup.styles.css"), recursive: false },
		{ src: join(srcDir, "icons"), dest: join(outDir, "icons"), recursive: true },
		{ src: join(srcDir, "icons-saved"), dest: join(outDir, "icons-saved"), recursive: true },
	];

	return { esbuildOptions, copies, directories };
}

export function initBuildExtension(deps: BuildExtensionDeps) {
	return async function buildExtension(input: {
		config: ExtensionBuildConfig;
		projectDir: string;
		serverUrl: string;
	}): Promise<void> {
		assert(input.serverUrl, "HUTCH_SERVER_URL environment variable is required.\nSet it before building (e.g. HUTCH_SERVER_URL=https://hutch-app.com)");

		const plan = createBuildPlan({
			config: input.config,
			projectDir: input.projectDir,
			serverUrl: input.serverUrl,
			corePackageJsonPath: deps.resolveCorePackageJson(),
		});

		for (const dir of plan.directories) {
			deps.mkdirSync(dir, { recursive: true });
		}

		await deps.esbuild(plan.esbuildOptions);

		for (const copy of plan.copies) {
			if (copy.recursive) {
				deps.cpSync(copy.src, copy.dest, { recursive: true });
			} else {
				deps.cpSync(copy.src, copy.dest);
			}
		}

		console.log("Extension built to dist-extension-compiled/");
	};
}
