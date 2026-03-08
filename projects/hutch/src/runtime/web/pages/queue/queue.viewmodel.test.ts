import type {
	ArticleId,
	Minutes,
	SavedArticle,
} from "../../../domain/article/article.types";
import type { UserId } from "../../../domain/user/user.types";
import type { FindArticlesResult } from "../../../providers/article-store/article-store.types";
import { toQueueViewModel } from "./queue.viewmodel";

function makeArticle(overrides?: Partial<SavedArticle>): SavedArticle {
	return {
		id: "art-1" as ArticleId,
		userId: "user-1" as UserId,
		url: "https://example.com/post",
		metadata: {
			title: "Test Article",
			siteName: "example.com",
			excerpt: "An excerpt",
			wordCount: 500,
		},
		estimatedReadTime: 3 as Minutes,
		status: "unread",
		savedAt: new Date("2025-06-01T12:00:00Z"),
		...overrides,
	};
}

function makeResult(
	articles: SavedArticle[],
	total?: number,
): FindArticlesResult {
	return {
		articles,
		total: total ?? articles.length,
		page: 1,
		pageSize: 20,
	};
}

const NOW = new Date("2025-06-01T13:00:00Z");
const DEFAULT_FILTERS = { order: "desc" as const, page: 1 };

describe("toQueueViewModel", () => {
	it("should map article fields to view model", () => {
		const vm = toQueueViewModel(makeResult([makeArticle()]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].title).toBe("Test Article");
		expect(vm.articles[0].siteName).toBe("example.com");
		expect(vm.articles[0].url).toBe("https://example.com/post");
	});

	it("should format read time label", () => {
		const vm = toQueueViewModel(
			makeResult([makeArticle({ estimatedReadTime: 5 as Minutes })]),
			DEFAULT_FILTERS,
			{ now: NOW },
		);

		expect(vm.articles[0].readTimeLabel).toBe("5 min read");
	});

	it("should format relative date as hours ago", () => {
		const vm = toQueueViewModel(makeResult([makeArticle()]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].savedAgo).toBe("1h ago");
	});

	it("should format recent date as minutes ago", () => {
		const article = makeArticle({
			savedAt: new Date("2025-06-01T12:50:00Z"),
		});
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].savedAgo).toBe("10m ago");
	});

	it("should calculate totalPages", () => {
		const result: FindArticlesResult = {
			articles: [],
			total: 45,
			page: 1,
			pageSize: 20,
		};
		const vm = toQueueViewModel(result, DEFAULT_FILTERS, { now: NOW });

		expect(vm.totalPages).toBe(3);
	});

	it("should set isEmpty when no articles", () => {
		const vm = toQueueViewModel(makeResult([]), DEFAULT_FILTERS, { now: NOW });

		expect(vm.isEmpty).toBe(true);
	});

	it("should include filter URLs", () => {
		const vm = toQueueViewModel(makeResult([]), DEFAULT_FILTERS, { now: NOW });

		expect(vm.filterUrls.all).toBe("/queue");
		expect(vm.filterUrls.unread).toBe("/queue?status=unread");
		expect(vm.filterUrls.read).toBe("/queue?status=read");
	});

	it("should include show URL toggle with 'Show URLs' when showUrl is off", () => {
		const vm = toQueueViewModel(makeResult([]), DEFAULT_FILTERS, { now: NOW });

		expect(vm.showUrlToggle.label).toBe("Show URLs");
		expect(vm.showUrlToggle.url).toContain("showUrl=true");
	});

	it("should include show URL toggle with 'Hide URLs' when showUrl is on", () => {
		const filters = { ...DEFAULT_FILTERS, showUrl: true as const };
		const vm = toQueueViewModel(makeResult([]), filters, { now: NOW });

		expect(vm.showUrlToggle.label).toBe("Hide URLs");
		expect(vm.showUrlToggle.url).not.toContain("showUrl");
	});

	it("should set isUnread to true for unread articles", () => {
		const article = makeArticle({ status: "unread" });
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].isUnread).toBe(true);
	});

	it("should set isUnread to false for read articles", () => {
		const article = makeArticle({ status: "read" });
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].isUnread).toBe(false);
	});

	it("should set isUnread to false for archived articles", () => {
		const article = makeArticle({ status: "archived" });
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].isUnread).toBe(false);
	});

	it("should pass imageUrl from article metadata to view model", () => {
		const article = makeArticle({
			metadata: {
				title: "Test Article",
				siteName: "example.com",
				excerpt: "An excerpt",
				wordCount: 500,
				imageUrl: "https://example.com/thumbnail.jpg",
			},
		});
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].imageUrl).toBe(
			"https://example.com/thumbnail.jpg",
		);
	});

	it("should leave imageUrl undefined when article has no image", () => {
		const vm = toQueueViewModel(makeResult([makeArticle()]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].imageUrl).toBeUndefined();
	});

	it("should format relative date as days ago", () => {
		const article = makeArticle({
			savedAt: new Date("2025-05-29T12:00:00Z"),
		});
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].savedAgo).toBe("3d ago");
	});

	it("should format date older than 30 days as full date", () => {
		const article = makeArticle({
			savedAt: new Date("2025-04-01T12:00:00Z"),
		});
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].savedAgo).toBe("1 Apr 2025");
	});

	it("should format very recent date as just now", () => {
		const article = makeArticle({
			savedAt: new Date("2025-06-01T12:59:50Z"),
		});
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].savedAgo).toBe("just now");
	});

	it("should generate next pagination URL when more pages exist", () => {
		const result: FindArticlesResult = {
			articles: [],
			total: 45,
			page: 1,
			pageSize: 20,
		};
		const vm = toQueueViewModel(result, DEFAULT_FILTERS, { now: NOW });

		expect(vm.paginationUrls.next).toBe("/queue?page=2");
	});

	it("should generate prev pagination URL on page 2", () => {
		const result: FindArticlesResult = {
			articles: [],
			total: 45,
			page: 2,
			pageSize: 20,
		};
		const vm = toQueueViewModel(result, { ...DEFAULT_FILTERS, page: 2 }, { now: NOW });

		expect(vm.paginationUrls.prev).toBe("/queue");
	});

	it("should not generate next pagination URL on last page", () => {
		const result: FindArticlesResult = {
			articles: [],
			total: 45,
			page: 3,
			pageSize: 20,
		};
		const vm = toQueueViewModel(result, { ...DEFAULT_FILTERS, page: 3 }, { now: NOW });

		expect(vm.paginationUrls.next).toBeUndefined();
	});

	it("should pass saveError through to view model", () => {
		const vm = toQueueViewModel(makeResult([]), DEFAULT_FILTERS, {
			now: NOW,
			saveError: "Could not parse article: Invalid URL",
		});

		expect(vm.saveError).toBe("Could not parse article: Invalid URL");
	});

	it("should set hasContent to true when article has content", () => {
		const article = makeArticle({ content: "<p>Some content</p>" });
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].hasContent).toBe(true);
	});

	it("should set hasContent to false when article has no content", () => {
		const article = makeArticle({ content: undefined });
		const vm = toQueueViewModel(makeResult([article]), DEFAULT_FILTERS, {
			now: NOW,
		});

		expect(vm.articles[0].hasContent).toBe(false);
	});
});
