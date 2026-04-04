import { fitContent } from "./content-size-guard";

describe("fitContent", () => {
	it("returns content unchanged when within byte limit", () => {
		const content = "a".repeat(100);
		expect(fitContent(content)).toBe(content);
	});

	it("returns undefined when content exceeds byte limit", () => {
		const content = "a".repeat(350_001);
		expect(fitContent(content)).toBeUndefined();
	});

	it("returns undefined for undefined input", () => {
		expect(fitContent(undefined)).toBeUndefined();
	});

	it("returns undefined for null input", () => {
		expect(fitContent(null)).toBeUndefined();
	});

	it("returns undefined for empty string input", () => {
		expect(fitContent("")).toBeUndefined();
	});

	it("returns content at exactly the byte limit", () => {
		const content = "a".repeat(350_000);
		expect(fitContent(content)).toBe(content);
	});

	it("measures multi-byte UTF-8 characters correctly", () => {
		const twoByteChar = "\u00e9"; // 2 bytes in UTF-8
		const content = twoByteChar.repeat(175_001); // 350_002 bytes > 350_000
		expect(fitContent(content)).toBeUndefined();
	});

	it("allows multi-byte content within byte limit", () => {
		const twoByteChar = "\u00e9";
		const content = twoByteChar.repeat(175_000); // 350_000 bytes = limit
		expect(fitContent(content)).toBe(content);
	});
});
