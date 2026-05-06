import { initInMemoryPendingHtml } from "./in-memory-pending-html";

describe("initInMemoryPendingHtml", () => {
	it("stores html under the URL's pending-html key and reads it back", async () => {
		const { putPendingHtml, readPendingHtml } = initInMemoryPendingHtml();

		await putPendingHtml({ url: "https://example.com/article", html: "<html>captured</html>" });

		expect(readPendingHtml("https://example.com/article")).toBe("<html>captured</html>");
	});

	it("treats different schemes of the same canonical URL as the same key", async () => {
		const { putPendingHtml, readPendingHtml } = initInMemoryPendingHtml();

		await putPendingHtml({ url: "https://example.com/article", html: "<html>captured</html>" });

		expect(readPendingHtml("http://example.com/article")).toBe("<html>captured</html>");
	});

	it("returns undefined when no html has been stored for the URL", () => {
		const { readPendingHtml } = initInMemoryPendingHtml();
		expect(readPendingHtml("https://example.com/never-saved")).toBeUndefined();
	});

	it("overwrites existing html for the same URL", async () => {
		const { putPendingHtml, readPendingHtml } = initInMemoryPendingHtml();

		await putPendingHtml({ url: "https://example.com/article", html: "<html>v1</html>" });
		await putPendingHtml({ url: "https://example.com/article", html: "<html>v2</html>" });

		expect(readPendingHtml("https://example.com/article")).toBe("<html>v2</html>");
	});
});
