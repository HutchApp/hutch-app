import { defaultGenerateVisitorId, parseVisitorId } from "./visitor-id";

describe("defaultGenerateVisitorId", () => {
	it("produces a 32-char hex string parsable as a VisitorId", () => {
		const id = defaultGenerateVisitorId();
		expect(id).toMatch(/^[0-9a-f]{32}$/);
		expect(parseVisitorId(id)).toBe(id);
	});

	it("produces a different id on each call", () => {
		expect(defaultGenerateVisitorId()).not.toBe(defaultGenerateVisitorId());
	});
});

describe("parseVisitorId", () => {
	it("returns the branded value when input matches the 32-char hex format", () => {
		const valid = "0123456789abcdef0123456789abcdef";
		expect(parseVisitorId(valid)).toBe(valid);
	});

	it("returns undefined for non-hex input — the cookie may have been tampered with or rotated to a new format", () => {
		expect(parseVisitorId("not-a-uuid")).toBeUndefined();
	});

	it("returns undefined for hex of the wrong length", () => {
		expect(parseVisitorId("0123456789abcdef")).toBeUndefined();
	});

	it("returns undefined for non-string input — express cookie parser can yield arrays or objects on duplicated/malformed Cookie headers", () => {
		expect(parseVisitorId(undefined)).toBeUndefined();
		expect(parseVisitorId(123)).toBeUndefined();
		expect(parseVisitorId({})).toBeUndefined();
	});
});
