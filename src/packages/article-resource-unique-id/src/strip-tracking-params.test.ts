import { stripTrackingParams } from "./strip-tracking-params";

describe("stripTrackingParams", () => {
	it("strips the `gi` tracking param added by Medium's 307 redirect", () => {
		expect(stripTrackingParams("https://example.com/article?gi=abc123"))
			.toBe("https://example.com/article");
	});

	it("strips the `source` and `sk` tracking params from a Medium friends link", () => {
		expect(stripTrackingParams("https://fagnerbrack.com/article?source=friends_link&sk=af337097bd3ecac5750a7fb1dcd0b91d"))
			.toBe("https://fagnerbrack.com/article");
	});

	it("strips every `utm_*` prefix (utm_source, utm_medium, utm_campaign)", () => {
		expect(stripTrackingParams("https://example.com/article?utm_source=twitter&utm_medium=social&utm_campaign=spring"))
			.toBe("https://example.com/article");
	});

	it("strips all known tracking params together and leaves no query string", () => {
		expect(stripTrackingParams("https://example.com/article?gi=x&source=friends_link&sk=abc&utm_source=twitter"))
			.toBe("https://example.com/article");
	});

	it("preserves a URL that has no query params at all", () => {
		expect(stripTrackingParams("https://example.com/article"))
			.toBe("https://example.com/article");
	});

	it("preserves legitimate (non-tracking) query params like q and page", () => {
		expect(stripTrackingParams("https://example.com/search?q=typescript&page=2"))
			.toBe("https://example.com/search?page=2&q=typescript");
	});

	it("keeps legitimate params and strips tracking params in the same URL", () => {
		expect(stripTrackingParams("https://example.com/search?q=typescript&utm_source=twitter&page=2&gi=abc"))
			.toBe("https://example.com/search?page=2&q=typescript");
	});

	it("produces deterministic (alphabetised) output regardless of input order", () => {
		expect(stripTrackingParams("https://example.com/path?page=2&q=1"))
			.toBe(stripTrackingParams("https://example.com/path?q=1&page=2"));
	});

	it("leaves the pathname and scheme intact", () => {
		expect(stripTrackingParams("https://example.com:8080/blog/post/?utm_source=x"))
			.toBe("https://example.com:8080/blog/post/");
	});

	it("re-encodes preserved params with special characters", () => {
		// space → %20 via URLSearchParams.append canonicalisation
		expect(stripTrackingParams("https://example.com/search?q=hello%20world&utm_source=x"))
			.toBe("https://example.com/search?q=hello+world");
	});
});
