import type {
	ArticleId,
	ArticleStatus,
	Minutes,
	SavedArticle,
} from "../../domain/article/article.types";
import type { UserId } from "../../domain/user/user.types";
import { toArticleSubEntity } from "./article-siren";

function makeArticle(overrides: Partial<SavedArticle> = {}): SavedArticle {
	return {
		id: "test-article-id" as ArticleId,
		userId: "test-user-id" as UserId,
		url: "https://example.com/article",
		metadata: {
			title: "Test Article",
			siteName: "Example",
			excerpt: "First paragraph...",
			wordCount: 1200,
			imageUrl: "https://example.com/image.jpg",
		},
		content: "<p>Full article content</p>",
		estimatedReadTime: 5 as Minutes,
		status: "unread" as ArticleStatus,
		savedAt: new Date("2026-03-04T10:00:00.000Z"),
		readAt: undefined,
		...overrides,
	};
}

describe("toArticleSubEntity", () => {
	it("maps sub-entity with exact properties (no content) and structure", () => {
		const article = makeArticle({ content: "<p>Full text</p>" });
		const subEntity = toArticleSubEntity(article);

		expect(subEntity).toEqual({
			class: ["article"],
			rel: ["item"],
			properties: {
				id: "test-article-id",
				url: "https://example.com/article",
				title: "Test Article",
				siteName: "Example",
				excerpt: "First paragraph...",
				wordCount: 1200,
				imageUrl: "https://example.com/image.jpg",
				estimatedReadTimeMinutes: 5,
				status: "unread",
				savedAt: "2026-03-04T10:00:00.000Z",
				readAt: null,
			},
			links: [{ rel: ["self"], href: "/queue/test-article-id" }],
		});
	});

	it("maps readAt when present", () => {
		const article = makeArticle({
			status: "read",
			readAt: new Date("2026-03-04T12:00:00.000Z"),
		});
		const subEntity = toArticleSubEntity(article);

		expect(subEntity.properties?.readAt).toBe("2026-03-04T12:00:00.000Z");
	});
});
