import { initInMemorySourceContent } from "./in-memory-source-content";
import { initInMemoryCanonicalContent } from "./in-memory-canonical-content";

function createStores() {
	const sourceContent = initInMemorySourceContent();
	const canonicalContent = initInMemoryCanonicalContent({
		readSourceContent: sourceContent.readSourceContent,
	});
	return { ...sourceContent, ...canonicalContent };
}

describe("initInMemoryCanonicalContent", () => {
	it("returns undefined when no canonical has been written for the URL", async () => {
		const { readCanonicalContent } = createStores();
		expect(await readCanonicalContent({ url: "https://example.com/never-saved" })).toBeUndefined();
	});

	it("promotes the per-source HTML to canonical and reads it back with the metadata", async () => {
		const stores = createStores();

		await stores.putSourceContent({
			url: "https://example.com/article",
			tier: "tier-0",
			html: "<p>tier 0 body</p>",
		});
		await stores.promoteSourceToCanonical({
			url: "https://example.com/article",
			tier: "tier-0",
			metadata: {
				title: "Test",
				siteName: "example.com",
				excerpt: "exc",
				wordCount: 42,
				estimatedReadTime: 1,
			},
		});

		expect(await stores.readCanonicalContent({ url: "https://example.com/article" })).toEqual({
			html: "<p>tier 0 body</p>",
			metadata: { title: "Test", wordCount: 42 },
		});
	});

	it("treats different schemes of the same canonical URL as the same key", async () => {
		const stores = createStores();

		await stores.putSourceContent({
			url: "https://example.com/article",
			tier: "tier-0",
			html: "<p>captured</p>",
		});
		await stores.promoteSourceToCanonical({
			url: "https://example.com/article",
			tier: "tier-0",
			metadata: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, estimatedReadTime: 1 },
		});

		expect(await stores.readCanonicalContent({ url: "http://example.com/article" })).toBeDefined();
	});

	it("seedCanonical writes a canonical entry directly for test setup", async () => {
		const { seedCanonical, readCanonicalContent } = createStores();

		seedCanonical({
			url: "https://example.com/article",
			html: "<p>seeded</p>",
			metadata: { title: "Seed", wordCount: 99 },
		});

		expect(await readCanonicalContent({ url: "https://example.com/article" })).toEqual({
			html: "<p>seeded</p>",
			metadata: { title: "Seed", wordCount: 99 },
		});
	});

	it("throws when promoting a source that has never been written", async () => {
		const { promoteSourceToCanonical } = createStores();
		await expect(
			promoteSourceToCanonical({
				url: "https://example.com/missing",
				tier: "tier-0",
				metadata: { title: "T", siteName: "s", excerpt: "e", wordCount: 1, estimatedReadTime: 1 },
			}),
		).rejects.toThrow(/cannot promote: no source HTML/);
	});
});
