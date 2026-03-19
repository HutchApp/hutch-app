import assert from "node:assert";
import { execSync as defaultExecSync, spawn as defaultSpawn } from "node:child_process";
import type { ChildProcess, ExecSyncOptions, SpawnOptions } from "node:child_process";
import { globSync as defaultGlobSync } from "node:fs";
import http from "node:http";

interface JestPhase {
	type: "jest";
	name: string;
	testMatch: string;
	timeout: number;
	testPathIgnorePatterns?: string;
	passWithNoTests?: boolean;
}

interface NodeTestPhase {
	type: "node-test";
	name: string;
	glob?: string;
	files?: string[];
	env?: Record<string, string>;
}

interface ScriptPhase {
	type: "script";
	name: string;
	command: string;
	env?: Record<string, string>;
}

interface PlaywrightPhase {
	type: "playwright";
	name: string;
	config: string;
	browsers: string[];
	server: {
		command: string[];
		url: string;
		waitTimeoutMs?: number;
		stripCoverage?: boolean;
	};
	env?: Record<string, string>;
}

export type TestPhase = JestPhase | NodeTestPhase | ScriptPhase | PlaywrightPhase;

export interface TestRunConfig {
	projectName: string;
	phases: TestPhase[];
}

interface ResolvedJestPhase {
	type: "jest";
	name: string;
	command: string;
	skip: false;
}

interface ResolvedNodeTestPhase {
	type: "node-test";
	name: string;
	command: string;
	env: Record<string, string>;
	files: string[];
	skip: boolean;
}

interface ResolvedScriptPhase {
	type: "script";
	name: string;
	command: string;
	env: Record<string, string>;
}

interface ResolvedPlaywrightPhase {
	type: "playwright";
	name: string;
	browserInstallCommand: string;
	serverSpawnArgs: string[];
	serverUrl: string;
	waitTimeoutMs: number;
	stripCoverage: boolean;
	testCommand: string;
	env: Record<string, string>;
}

export type ResolvedPhase =
	| ResolvedJestPhase
	| ResolvedNodeTestPhase
	| ResolvedScriptPhase
	| ResolvedPlaywrightPhase;

export interface TestPlan {
	projectName: string;
	phases: ResolvedPhase[];
	runAllPhases(): Promise<void>;
}

type ExecSyncFn = (command: string, options: ExecSyncOptions) => Buffer | string;
type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type GlobSyncFn = (pattern: string) => string[];
type WaitForServerFn = (url: string, timeoutMs: number) => Promise<void>;

export interface TestPhaseRunnerDeps {
	execSync: ExecSyncFn;
	spawn: SpawnFn;
	globSync: GlobSyncFn;
	waitForServer: WaitForServerFn;
}

function resolveJestPhase(phase: JestPhase): ResolvedJestPhase {
	const parts = [
		"node_modules/.bin/jest",
		`--testMatch="${phase.testMatch}"`,
		`--testTimeout=${phase.timeout}`,
		"--runInBand",
	];
	if (phase.testPathIgnorePatterns) {
		parts.push(`--testPathIgnorePatterns="${phase.testPathIgnorePatterns}"`);
	}
	if (phase.passWithNoTests) {
		parts.push("--passWithNoTests");
	}
	return { type: "jest", name: phase.name, command: parts.join(" "), skip: false };
}

function resolveNodeTestPhase(phase: NodeTestPhase, globSync: GlobSyncFn): ResolvedNodeTestPhase {
	let files: string[];
	if (phase.glob) {
		files = globSync(phase.glob);
	} else {
		files = phase.files ?? [];
	}
	const skip = files.length === 0;
	const command = skip ? "" : `node --test ${files.join(" ")}`;
	return { type: "node-test", name: phase.name, command, env: phase.env ?? {}, files, skip };
}

function resolveScriptPhase(phase: ScriptPhase): ResolvedScriptPhase {
	return { type: "script", name: phase.name, command: phase.command, env: phase.env ?? {} };
}

function resolvePlaywrightPhase(phase: PlaywrightPhase): ResolvedPlaywrightPhase {
	const browsers = phase.browsers.join(" ");
	return {
		type: "playwright",
		name: phase.name,
		browserInstallCommand: `node_modules/.bin/playwright install --with-deps ${browsers}`,
		serverSpawnArgs: phase.server.command,
		serverUrl: phase.server.url,
		waitTimeoutMs: phase.server.waitTimeoutMs ?? 15000,
		stripCoverage: phase.server.stripCoverage ?? false,
		testCommand: `node_modules/.bin/playwright test --config ${phase.config}`,
		env: phase.env ?? {},
	};
}

function defaultWaitForServer(url: string, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + timeoutMs;
		function attempt() {
			http
				.get(url, (res) => {
					res.resume();
					resolve();
				})
				.on("error", () => {
					if (Date.now() > deadline) {
						reject(new Error(`Server at ${url} did not start within ${timeoutMs}ms`));
						return;
					}
					setTimeout(attempt, 200);
				});
		}
		attempt();
	});
}

export const defaultDeps: TestPhaseRunnerDeps = {
	execSync: defaultExecSync as ExecSyncFn,
	spawn: defaultSpawn,
	globSync: defaultGlobSync,
	waitForServer: defaultWaitForServer,
};

export function initTestPhaseRunner(deps: TestPhaseRunnerDeps) {
	function runCommand(displayName: string, command: string, options: { cwd: string; extraEnv?: Record<string, string> }) {
		console.log(`\n=== ${displayName} ===\n`);
		deps.execSync(command, {
			cwd: options.cwd,
			stdio: "inherit",
			env: { ...process.env, ...options.extraEnv },
		});
	}

	async function runPlaywrightPhase(displayName: string, phase: ResolvedPlaywrightPhase, projectRoot: string) {
		console.log(`\n=== ${displayName} ===\n`);

		deps.execSync(phase.browserInstallCommand, {
			cwd: projectRoot,
			stdio: "inherit",
		});

		const spawnCommand = phase.stripCoverage ? "env" : phase.serverSpawnArgs[0];
		const spawnArgs = phase.stripCoverage
			? ["-u", "NODE_V8_COVERAGE", ...phase.serverSpawnArgs]
			: phase.serverSpawnArgs.slice(1);

		const serverProcess = deps.spawn(spawnCommand, spawnArgs, {
			cwd: projectRoot,
			stdio: "inherit",
		});

		try {
			await deps.waitForServer(phase.serverUrl, phase.waitTimeoutMs);

			deps.execSync(phase.testCommand, {
				cwd: projectRoot,
				stdio: "inherit",
				env: { ...process.env, ...phase.env },
			});
		} finally {
			serverProcess.kill("SIGTERM");
		}
	}

	return {
		createTestPlan(input: { config: TestRunConfig; projectRoot: string }): TestPlan {
			assert(input.config.projectName, "projectName is required");
			assert(input.config.phases.length > 0, "At least one test phase is required");

			const resolvedPhases = input.config.phases.map((phase): ResolvedPhase => {
				switch (phase.type) {
					case "jest":
						return resolveJestPhase(phase);
					case "node-test":
						return resolveNodeTestPhase(phase, deps.globSync);
					case "script":
						return resolveScriptPhase(phase);
					case "playwright":
						return resolvePlaywrightPhase(phase);
					default: {
						const _exhaustive: never = phase;
						return _exhaustive;
					}
				}
			});

			return {
				projectName: input.config.projectName,
				phases: resolvedPhases,
				async runAllPhases() {
					for (const phase of resolvedPhases) {
						const displayName = `${input.config.projectName} - ${phase.name}`;

						if (phase.type === "node-test" && phase.skip) {
							continue;
						}

						if (phase.type === "playwright") {
							await runPlaywrightPhase(displayName, phase, input.projectRoot);
							continue;
						}

						runCommand(displayName, phase.command, {
							cwd: input.projectRoot,
							extraEnv: "env" in phase ? phase.env : undefined,
						});
					}

					console.log(`\n=== ${input.config.projectName} - All tests completed successfully ===\n`);
				},
			};
		},
	};
}
