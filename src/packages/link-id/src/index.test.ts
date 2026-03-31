import { LinkId } from "./index";

describe("LinkId.from", () => {
	it("strips https scheme", () => {
		expect(LinkId.from("https://example.com/article")).toBe("example.com/article");
	});

	it("strips http scheme", () => {
		expect(LinkId.from("http://example.com/article")).toBe("example.com/article");
	});

	it("strips fragment", () => {
		expect(LinkId.from("https://example.com/article#heading")).toBe("example.com/article");
	});

	it("preserves query params", () => {
		expect(LinkId.from("https://example.com/path?q=1&page=2")).toBe("example.com/path?q=1&page=2");
	});

	it("preserves non-default port", () => {
		expect(LinkId.from("https://example.com:8080/path")).toBe("example.com:8080/path");
	});

	it("omits default https port 443", () => {
		expect(LinkId.from("https://example.com:443/path")).toBe("example.com/path");
	});

	it("omits default http port 80", () => {
		expect(LinkId.from("http://example.com:80/path")).toBe("example.com/path");
	});

	it("handles root path", () => {
		expect(LinkId.from("https://example.com/")).toBe("example.com/");
	});

	it("handles root path without trailing slash", () => {
		expect(LinkId.from("https://example.com")).toBe("example.com/");
	});

	it("produces same ID regardless of scheme", () => {
		expect(LinkId.from("https://example.com/article")).toBe(LinkId.from("http://example.com/article"));
	});
});
