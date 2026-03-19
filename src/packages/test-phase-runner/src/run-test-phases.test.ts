import type { ExecSyncOptions, SpawnOptions } from "node:child_process";
import { initTestPhaseRunner } from "./run-test-phases";
import type { ResolvedPhase, TestPhaseRunnerDeps } from "./run-test-phases";

function createInMemoryDeps() {
	const executedCommands: Array<{ command: string; cwd?: string | URL; env?: NodeJS.ProcessEnv }> = [];
	const spawnedProcesses: Array<{ command: string; args: string[]; cwd?: string | URL }> = [];
	let waitForServerCalls = 0;
	let _killCalled = false;

	const deps: TestPhaseRunnerDeps = {
		execSync: (command: string, options: ExecSyncOptions) => {
			executedCommands.push({ command, cwd: options.cwd, env: options.env });
			return Buffer.from("");
		},
		spawn: (command: string, args: string[], options: SpawnOptions) => {
			spawnedProcesses.push({ command, args, cwd: options.cwd });
			return {
				kill: (_signal: string) => {
					_killCalled = true;
				},
			} as ReturnType<typeof import("node:child_process").spawn>;
		},
		globSync: (pattern: string) => {
			if (pattern.includes("empty")) return [];
			return ["dist/e2e/test1.test.js", "dist/e2e/test2.test.js"];
		},
		waitForServer: async (_url: string, _timeoutMs: number) => {
			waitForServerCalls++;
		},
	};

	return {
		deps,
		executedCommands,
		spawnedProcesses,
		getWaitForServerCalls: () => waitForServerCalls,
		getKillCalled: () => _killCalled,
	};
}

function createRunner(deps?: Parameters<typeof initTestPhaseRunner>[0]) {
	return initTestPhaseRunner(deps);
}

describe("createTestPlan", () => {
	const projectRoot = "/projects/test-project";

	it("throws when projectName is empty", () => {
		const runner = createRunner();
		expect(() =>
			runner.createTestPlan({
				config: { projectName: "", phases: [{ type: "jest", name: "unit tests", testMatch: "**/*.test.js", timeout: 10000 }] },
				projectRoot,
			}),
		).toThrow("projectName");
	});

	it("throws when phases array is empty", () => {
		const runner = createRunner();
		expect(() =>
			runner.createTestPlan({
				config: { projectName: "Test", phases: [] },
				projectRoot,
			}),
		).toThrow("At least one test phase");
	});
});

describe("jest phase resolution", () => {
	const projectRoot = "/projects/test-project";

	it("resolves jest command with testMatch and timeout", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "jest", name: "unit tests", testMatch: "**/dist/**/*.test.js", timeout: 10000 }],
			},
			projectRoot,
		});

		expect(plan.phases[0]).toEqual({
			type: "jest",
			name: "unit tests",
			command: 'node_modules/.bin/jest --testMatch="**/dist/**/*.test.js" --testTimeout=10000 --runInBand',
			skip: false,
		});
	});

	it("includes testPathIgnorePatterns when specified", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [
					{
						type: "jest",
						name: "unit tests",
						testMatch: "**/dist/**/*.test.js",
						timeout: 10000,
						testPathIgnorePatterns: "dist/e2e",
					},
				],
			},
			projectRoot,
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "jest" }>;
		expect(phase.command).toContain('--testPathIgnorePatterns="dist/e2e"');
	});

	it("includes passWithNoTests flag when set", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [
					{
						type: "jest",
						name: "unit tests",
						testMatch: "**/dist/**/*.test.js",
						timeout: 10000,
						passWithNoTests: true,
					},
				],
			},
			projectRoot,
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "jest" }>;
		expect(phase.command).toContain("--passWithNoTests");
	});

	it("uses different timeout for integration tests", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "jest", name: "integration tests", testMatch: "**/dist/**/*.integration.js", timeout: 30000 }],
			},
			projectRoot,
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "jest" }>;
		expect(phase.command).toContain("--testTimeout=30000");
	});
});

describe("node-test phase resolution", () => {
	it("resolves files from glob pattern", () => {
		const { deps } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E unit tests", glob: "dist/e2e/**/*.test.js" }],
			},
			projectRoot: "/projects/test",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "node-test" }>;
		expect(phase.files).toEqual(["dist/e2e/test1.test.js", "dist/e2e/test2.test.js"]);
		expect(phase.command).toBe("node --test dist/e2e/test1.test.js dist/e2e/test2.test.js");
		expect(phase.skip).toBe(false);
	});

	it("marks phase as skip when glob matches no files", () => {
		const { deps } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E unit tests", glob: "empty/**/*.test.js" }],
			},
			projectRoot: "/projects/test",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "node-test" }>;
		expect(phase.skip).toBe(true);
		expect(phase.files).toEqual([]);
	});

	it("uses explicit files when provided", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E tests", files: ["dist/e2e/login-flow/run.e2e-local.js"] }],
			},
			projectRoot: "/projects/test",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "node-test" }>;
		expect(phase.command).toBe("node --test dist/e2e/login-flow/run.e2e-local.js");
	});

	it("preserves env vars", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E tests", files: ["test.js"], env: { HEADLESS: "true" } }],
			},
			projectRoot: "/projects/test",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "node-test" }>;
		expect(phase.env).toEqual({ HEADLESS: "true" });
	});
});

describe("script phase resolution", () => {
	it("preserves command and env", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [
					{
						type: "script",
						name: "Building extension",
						command: "node scripts/build-extension.js",
						env: { HUTCH_SERVER_URL: "http://127.0.0.1:3000" },
					},
				],
			},
			projectRoot: "/projects/test",
		});

		expect(plan.phases[0]).toEqual({
			type: "script",
			name: "Building extension",
			command: "node scripts/build-extension.js",
			env: { HUTCH_SERVER_URL: "http://127.0.0.1:3000" },
		});
	});
});

describe("playwright phase resolution", () => {
	it("resolves browser install command", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "dist/e2e/e2e-server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.browserInstallCommand).toBe("node_modules/.bin/playwright install --with-deps chromium");
	});

	it("resolves test command with config", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "dist/e2e/e2e-server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.testCommand).toBe("node_modules/.bin/playwright test --config playwright.config.local-dev.ts");
	});

	it("defaults waitTimeoutMs to 15000", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "dist/e2e/e2e-server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.waitTimeoutMs).toBe(15000);
	});

	it("uses custom waitTimeoutMs when provided", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "server.js"], url: "http://localhost:3100", waitTimeoutMs: 30000 },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.waitTimeoutMs).toBe(30000);
	});

	it("defaults stripCoverage to false", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.stripCoverage).toBe(false);
	});

	it("sets stripCoverage when configured", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "server.js"], url: "http://localhost:3100", stripCoverage: true },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.stripCoverage).toBe(true);
	});

	it("supports multiple browsers", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium", "firefox"],
						server: { command: ["node", "server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		const phase = plan.phases[0] as Extract<ResolvedPhase, { type: "playwright" }>;
		expect(phase.browserInstallCommand).toBe("node_modules/.bin/playwright install --with-deps chromium firefox");
	});
});

describe("runAllPhases execution", () => {
	it("executes jest phase with correct cwd", async () => {
		const { deps, executedCommands } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "jest", name: "unit tests", testMatch: "**/dist/**/*.test.js", timeout: 10000 }],
			},
			projectRoot: "/projects/test",
		});

		await plan.runAllPhases();

		expect(executedCommands[0].command).toContain("jest");
		expect(executedCommands[0].cwd).toBe("/projects/test");
	});

	it("skips node-test phase when no files match glob", async () => {
		const { deps, executedCommands } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E unit tests", glob: "empty/**/*.test.js" }],
			},
			projectRoot: "/projects/test",
		});

		await plan.runAllPhases();

		expect(executedCommands).toHaveLength(0);
	});

	it("executes node-test phase with env vars", async () => {
		const { deps, executedCommands } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [{ type: "node-test", name: "E2E tests", files: ["test.e2e.js"], env: { HEADLESS: "true" } }],
			},
			projectRoot: "/projects/test",
		});

		await plan.runAllPhases();

		expect(executedCommands[0].env).toEqual(expect.objectContaining({ HEADLESS: "true" }));
	});

	it("executes script phase with env vars", async () => {
		const { deps, executedCommands } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "My Project",
				phases: [
					{
						type: "script",
						name: "Build extension",
						command: "node scripts/build-extension.js",
						env: { HUTCH_SERVER_URL: "http://localhost:3000" },
					},
				],
			},
			projectRoot: "/projects/test",
		});

		await plan.runAllPhases();

		expect(executedCommands[0].command).toBe("node scripts/build-extension.js");
		expect(executedCommands[0].env).toEqual(expect.objectContaining({ HUTCH_SERVER_URL: "http://localhost:3000" }));
	});

	it("executes playwright phase with server lifecycle", async () => {
		const { deps, executedCommands, spawnedProcesses, getWaitForServerCalls, getKillCalled } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: {
							command: ["node", "dist/e2e/e2e-server.js"],
							url: "http://localhost:3100",
							stripCoverage: true,
						},
						env: { HEADLESS: "true" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		await plan.runAllPhases();

		expect(executedCommands[0].command).toContain("playwright install");
		expect(spawnedProcesses[0].command).toBe("env");
		expect(spawnedProcesses[0].args).toEqual(["-u", "NODE_V8_COVERAGE", "node", "dist/e2e/e2e-server.js"]);
		expect(getWaitForServerCalls()).toBe(1);
		expect(executedCommands[1].command).toContain("playwright test");
		expect(getKillCalled()).toBe(true);
	});

	it("spawns server directly when stripCoverage is false", async () => {
		const { deps, spawnedProcesses } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: {
							command: ["node", "dist/e2e/e2e-server.js"],
							url: "http://localhost:3100",
							stripCoverage: false,
						},
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		await plan.runAllPhases();

		expect(spawnedProcesses[0].command).toBe("node");
		expect(spawnedProcesses[0].args).toEqual(["dist/e2e/e2e-server.js"]);
	});

	it("kills server even when playwright test command fails", async () => {
		let killCalled = false;
		const deps: TestPhaseRunnerDeps = {
			execSync: (command: string, _options: ExecSyncOptions) => {
				if (command.includes("playwright test")) {
					throw new Error("Test failed");
				}
				return Buffer.from("");
			},
			spawn: (_command: string, _args: string[], _options: SpawnOptions) => {
				return {
					kill: () => {
						killCalled = true;
					},
				} as ReturnType<typeof import("node:child_process").spawn>;
			},
			globSync: () => [],
			waitForServer: async () => {},
		};

		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{
						type: "playwright",
						name: "E2E tests",
						config: "playwright.config.local-dev.ts",
						browsers: ["chromium"],
						server: { command: ["node", "server.js"], url: "http://localhost:3100" },
					},
				],
			},
			projectRoot: "/projects/hutch",
		});

		await expect(plan.runAllPhases()).rejects.toThrow("Test failed");
		expect(killCalled).toBe(true);
	});

	it("executes multiple phases in order", async () => {
		const { deps, executedCommands } = createInMemoryDeps();
		const runner = createRunner(deps);
		const plan = runner.createTestPlan({
			config: {
				projectName: "Hutch",
				phases: [
					{ type: "jest", name: "unit tests", testMatch: "**/dist/**/*.test.js", timeout: 10000 },
					{ type: "jest", name: "integration tests", testMatch: "**/dist/**/*.integration.js", timeout: 30000, passWithNoTests: true },
				],
			},
			projectRoot: "/projects/hutch",
		});

		await plan.runAllPhases();

		expect(executedCommands[0].command).toContain("*.test.js");
		expect(executedCommands[1].command).toContain("*.integration.js");
	});
});

describe("plan metadata", () => {
	it("exposes projectName", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Browser Extension Core",
				phases: [{ type: "jest", name: "unit tests", testMatch: "**/*.test.js", timeout: 10000 }],
			},
			projectRoot: "/projects/test",
		});

		expect(plan.projectName).toBe("Browser Extension Core");
	});

	it("exposes all resolved phases", () => {
		const runner = createRunner();
		const plan = runner.createTestPlan({
			config: {
				projectName: "Test",
				phases: [
					{ type: "jest", name: "unit tests", testMatch: "**/*.test.js", timeout: 10000 },
					{ type: "script", name: "build", command: "node build.js" },
				],
			},
			projectRoot: "/projects/test",
		});

		expect(plan.phases).toHaveLength(2);
		expect(plan.phases[0].type).toBe("jest");
		expect(plan.phases[1].type).toBe("script");
	});
});
