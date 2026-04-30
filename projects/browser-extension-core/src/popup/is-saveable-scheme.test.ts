import { isSaveableScheme } from "./is-saveable-scheme";

describe("isSaveableScheme", () => {
	const allowedSchemes = ["http", "https"];

	it("returns true for an http URL", () => {
		expect(
			isSaveableScheme({ tabUrl: "http://example.com/article", allowedSchemes }),
		).toBe(true);
	});

	it("returns true for an https URL", () => {
		expect(
			isSaveableScheme({ tabUrl: "https://example.com/article", allowedSchemes }),
		).toBe(true);
	});

	it("returns false for chrome:// internal pages", () => {
		expect(
			isSaveableScheme({ tabUrl: "chrome://newtab/", allowedSchemes }),
		).toBe(false);
	});

	it("returns false for about: pages", () => {
		expect(
			isSaveableScheme({ tabUrl: "about:blank", allowedSchemes }),
		).toBe(false);
	});

	it("returns false for file: URLs", () => {
		expect(
			isSaveableScheme({ tabUrl: "file:///etc/hosts", allowedSchemes }),
		).toBe(false);
	});

	it("returns false for view-source: URLs", () => {
		expect(
			isSaveableScheme({ tabUrl: "view-source:https://example.com", allowedSchemes }),
		).toBe(false);
	});

	it("returns false for an unparseable URL", () => {
		expect(
			isSaveableScheme({ tabUrl: "not a url", allowedSchemes }),
		).toBe(false);
	});

	it("respects an extended scheme list from the server", () => {
		expect(
			isSaveableScheme({
				tabUrl: "ftp://example.com/file.txt",
				allowedSchemes: ["http", "https", "ftp"],
			}),
		).toBe(true);
	});
});
