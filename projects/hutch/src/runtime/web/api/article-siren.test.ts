import type {
	ArticleId,
	ArticleStatus,
	Minutes,
	SavedArticle,
} from "../../domain/article/article.types";
import type { UserId } from "../../domain/user/user.types";
import { toArticleEntity, toArticleSubEntity } from "./article-siren";

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

describe("toArticleEntity", () => {
	it("maps article properties correctly", () => {
		const article = makeArticle();
		const entity = toArticleEntity(article);

		expect(entity.class).toContain("article");
		expect(entity.properties).toMatchObject({
			id: "test-article-id",
			url: "https://example.com/article",
			title: "Test Article",
			siteName: "Example",
			excerpt: "First paragraph...",
			wordCount: 1200,
			imageUrl: "https://example.com/image.jpg",
			estimatedReadTimeMinutes: 5,
			content: "<p>Full article content</p>",
			status: "unread",
			savedAt: "2026-03-04T10:00:00.000Z",
			readAt: null,
		});
	});

	it("includes content in full entity form", () => {
		const article = makeArticle({ content: "<p>Full text</p>" });
		const entity = toArticleEntity(article);

		expect(entity.properties?.content).toBe("<p>Full text</p>");
	});

	it("includes self, collection, and root links", () => {
		const article = makeArticle();
		const entity = toArticleEntity(article);

		expect(entity.links).toContainEqual({
			rel: ["self"],
			href: "/queue/test-article-id",
		});
		expect(entity.links).toContainEqual({
			rel: ["collection"],
			href: "/queue",
		});
		expect(entity.links).toContainEqual({ rel: ["root"], href: "/queue" });
	});

	it("unread article has mark-read and archive actions but not mark-unread", () => {
		const article = makeArticle({ status: "unread" });
		const entity = toArticleEntity(article);

		const actionNames = entity.actions?.map((a) => a.name) ?? [];
		expect(actionNames).toContain("mark-read");
		expect(actionNames).toContain("archive");
		expect(actionNames).toContain("delete");
		expect(actionNames).not.toContain("mark-unread");
	});

	it("read article has mark-unread and archive actions but not mark-read", () => {
		const article = makeArticle({ status: "read" });
		const entity = toArticleEntity(article);

		const actionNames = entity.actions?.map((a) => a.name) ?? [];
		expect(actionNames).toContain("mark-unread");
		expect(actionNames).toContain("archive");
		expect(actionNames).toContain("delete");
		expect(actionNames).not.toContain("mark-read");
	});

	it("archived article has mark-unread and mark-read actions but not archive", () => {
		const article = makeArticle({ status: "archived" });
		const entity = toArticleEntity(article);

		const actionNames = entity.actions?.map((a) => a.name) ?? [];
		expect(actionNames).toContain("mark-unread");
		expect(actionNames).toContain("mark-read");
		expect(actionNames).toContain("delete");
		expect(actionNames).not.toContain("archive");
	});

	it("mark-read action has correct fields with hidden status value", () => {
		const article = makeArticle({ status: "unread" });
		const entity = toArticleEntity(article);

		const markReadAction = entity.actions?.find((a) => a.name === "mark-read");
		expect(markReadAction).toBeDefined();
		expect(markReadAction?.method).toBe("PUT");
		expect(markReadAction?.type).toBe("application/json");
		expect(markReadAction?.fields).toContainEqual({
			name: "status",
			type: "hidden",
			value: "read",
		});
	});

	it("maps readAt when present", () => {
		const article = makeArticle({
			status: "read",
			readAt: new Date("2026-03-04T12:00:00.000Z"),
		});
		const entity = toArticleEntity(article);

		expect(entity.properties?.readAt).toBe("2026-03-04T12:00:00.000Z");
	});
});

describe("toArticleSubEntity", () => {
	it("omits content in embedded sub-entity form", () => {
		const article = makeArticle({ content: "<p>Full text</p>" });
		const subEntity = toArticleSubEntity(article);

		expect(subEntity.properties?.content).toBeUndefined();
	});

	it("includes rel: item for collection embedding", () => {
		const article = makeArticle();
		const subEntity = toArticleSubEntity(article);

		expect(subEntity.rel).toContain("item");
	});

	it("includes only self link (not collection or root)", () => {
		const article = makeArticle();
		const subEntity = toArticleSubEntity(article);

		expect(subEntity.links).toHaveLength(1);
		expect(subEntity.links).toContainEqual({
			rel: ["self"],
			href: "/queue/test-article-id",
		});
	});

	it("does not include actions (actions are on full entity only)", () => {
		const article = makeArticle();
		const subEntity = toArticleSubEntity(article);

		expect(subEntity.actions).toBeUndefined();
	});
});
