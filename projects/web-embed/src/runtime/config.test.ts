import { loadConfigFromEnv } from "./config";

describe("loadConfigFromEnv", () => {
	const originalEnv = { ...process.env };

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("should read PORT, APP_ORIGIN, and EMBED_ORIGIN from the environment", () => {
		process.env = {
			PORT: "4000",
			APP_ORIGIN: "https://readplace.com",
			EMBED_ORIGIN: "https://embed.readplace.com",
		};
		const config = loadConfigFromEnv();
		expect(config.port).toBe(4000);
		expect(config.appOrigin).toBe("https://readplace.com");
		expect(config.embedOrigin).toBe("https://embed.readplace.com");
	});

	it("should throw when PORT is unset", () => {
		process.env = { APP_ORIGIN: "https://readplace.com", EMBED_ORIGIN: "http://localhost:3500" };
		expect(() => loadConfigFromEnv()).toThrow(/PORT/);
	});

	it("should throw when APP_ORIGIN is unset", () => {
		process.env = { PORT: "3500", EMBED_ORIGIN: "http://localhost:3500" };
		expect(() => loadConfigFromEnv()).toThrow(/APP_ORIGIN/);
	});

	it("should throw when EMBED_ORIGIN is unset", () => {
		process.env = { PORT: "3500", APP_ORIGIN: "https://readplace.com" };
		expect(() => loadConfigFromEnv()).toThrow(/EMBED_ORIGIN/);
	});
});
