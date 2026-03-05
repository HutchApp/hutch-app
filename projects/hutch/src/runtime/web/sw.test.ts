import { SERVICE_WORKER_SOURCE } from "./sw.source";

const swSource = SERVICE_WORKER_SOURCE;

function extractFunction(name: string): string {
	const pattern = new RegExp(
		`function ${name}\\b[^{]*\\{`,
	);
	const match = swSource.match(pattern);
	if (!match?.index) throw new Error(`Function ${name} not found in sw.js`);

	let braces = 1;
	let i = match.index + match[0].length;
	while (braces > 0 && i < swSource.length) {
		if (swSource[i] === "{") braces++;
		if (swSource[i] === "}") braces--;
		i++;
	}
	return swSource.slice(match.index, i);
}

function extractConstants(): string {
	const lines = swSource.split("\n");
	return lines
		.filter((line) => line.startsWith("var ") && line.includes(" = "))
		.filter((line) => !line.includes("function"))
		.join("\n");
}

function evalFunction(name: string): Function {
	const constants = extractConstants();
	const code = extractFunction(name);
	return new Function(`${constants}\n${code}\nreturn ${name};`)();
}

describe("Service worker: isArticleRoute", () => {
	const isArticleRoute = evalFunction("isArticleRoute") as (
		url: string,
	) => boolean;

	it("should match /queue", () => {
		expect(isArticleRoute("https://hutch.app/queue")).toBe(true);
	});

	it("should match /queue/:id/read", () => {
		expect(isArticleRoute("https://hutch.app/queue/abc-123/read")).toBe(true);
	});

	it("should not match /login", () => {
		expect(isArticleRoute("https://hutch.app/login")).toBe(false);
	});

	it("should not match /queue/save", () => {
		expect(isArticleRoute("https://hutch.app/queue/save")).toBe(false);
	});

	it("should not match /queue/:id/status", () => {
		expect(isArticleRoute("https://hutch.app/queue/abc/status")).toBe(false);
	});

	it("should not match the root path", () => {
		expect(isArticleRoute("https://hutch.app/")).toBe(false);
	});
});

describe("Service worker: isCacheExpired", () => {
	const isCacheExpired = evalFunction("isCacheExpired") as (
		response: { headers: { get(name: string): string | null } },
	) => boolean;

	it("should return true when sw-cached-at header is missing", () => {
		const response = { headers: { get: () => null } };
		expect(isCacheExpired(response)).toBe(true);
	});

	it("should return false when cached less than 24h ago", () => {
		const recentTimestamp = String(Date.now() - 1000);
		const response = {
			headers: { get: (name: string) => name === "sw-cached-at" ? recentTimestamp : null },
		};
		expect(isCacheExpired(response)).toBe(false);
	});

	it("should return true when cached more than 24h ago", () => {
		const oldTimestamp = String(Date.now() - 25 * 60 * 60 * 1000);
		const response = {
			headers: { get: (name: string) => name === "sw-cached-at" ? oldTimestamp : null },
		};
		expect(isCacheExpired(response)).toBe(true);
	});
});

describe("Service worker: isStaleConnection", () => {
	const originalNavigator = globalThis.navigator;

	afterEach(() => {
		Object.defineProperty(globalThis, "navigator", {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
	});

	function createIsStaleConnection(connection?: object): () => boolean {
		Object.defineProperty(globalThis, "navigator", {
			value: { connection },
			writable: true,
			configurable: true,
		});
		return evalFunction("isStaleConnection") as () => boolean;
	}

	it("should return false when connection API is unavailable", () => {
		const isStaleConnection = createIsStaleConnection(undefined);
		expect(isStaleConnection()).toBe(false);
	});

	it("should return true when saveData is enabled", () => {
		const isStaleConnection = createIsStaleConnection({
			saveData: true,
			effectiveType: "4g",
		});
		expect(isStaleConnection()).toBe(true);
	});

	it("should return true on slow-2g", () => {
		const isStaleConnection = createIsStaleConnection({
			saveData: false,
			effectiveType: "slow-2g",
		});
		expect(isStaleConnection()).toBe(true);
	});

	it("should return true on 2g", () => {
		const isStaleConnection = createIsStaleConnection({
			saveData: false,
			effectiveType: "2g",
		});
		expect(isStaleConnection()).toBe(true);
	});

	it("should return false on 4g", () => {
		const isStaleConnection = createIsStaleConnection({
			saveData: false,
			effectiveType: "4g",
		});
		expect(isStaleConnection()).toBe(false);
	});

	it("should return false on 3g", () => {
		const isStaleConnection = createIsStaleConnection({
			saveData: false,
			effectiveType: "3g",
		});
		expect(isStaleConnection()).toBe(false);
	});
});

describe("Service worker: cache versioning", () => {
	it("should define CACHE_NAME with version prefix", () => {
		expect(swSource).toContain("var CACHE_NAME = 'hutch-offline-v");
	});

	it("should clean up old caches with hutch-offline- prefix on activate", () => {
		expect(swSource).toContain("hutch-offline-");
		expect(swSource).toContain("caches.delete(name)");
	});
});

describe("Service worker: MAX_AGE_MS", () => {
	it("should be set to 24 hours in milliseconds", () => {
		expect(swSource).toContain("var MAX_AGE_MS = 24 * 60 * 60 * 1000");
	});
});

describe("Service worker: fetch handler", () => {
	it("should only intercept GET requests", () => {
		expect(swSource).toContain("event.request.method !== 'GET'");
	});

	it("should only intercept article routes", () => {
		expect(swSource).toContain("isArticleRoute(event.request.url)");
	});

	it("should only intercept HTML requests", () => {
		expect(swSource).toContain("text/html");
	});

	it("should serve offline fallback when network fails and no cache", () => {
		expect(swSource).toContain("You are offline");
	});
});
