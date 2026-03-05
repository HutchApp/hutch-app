import type {
	FindArticlesResult,
	SortOrder,
} from "../../providers/article-store/article-store.types";
import type { ArticleStatus } from "../../domain/article/article.types";
import type { SirenEntity, SirenLink } from "./siren";
import { toArticleSubEntity } from "./article-siren";

interface CollectionQueryParams {
	status?: ArticleStatus;
	order?: SortOrder;
	page?: number;
	pageSize?: number;
}

function buildQueryString(params: CollectionQueryParams): string {
	const parts: string[] = [];
	if (params.status) parts.push(`status=${params.status}`);
	if (params.order) parts.push(`order=${params.order}`);
	if (params.page) parts.push(`page=${params.page}`);
	if (params.pageSize) parts.push(`pageSize=${params.pageSize}`);
	return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export function toArticleCollectionEntity(
	result: FindArticlesResult,
	queryParams: CollectionQueryParams,
): SirenEntity {
	const { articles, total, page, pageSize } = result;
	const totalPages = Math.ceil(total / pageSize);

	const links: SirenLink[] = [
		{ rel: ["self"], href: `/api/articles${buildQueryString(queryParams)}` },
		{ rel: ["root"], href: "/api" },
	];

	if (page > 1) {
		links.push({
			rel: ["prev"],
			href: `/api/articles${buildQueryString({ ...queryParams, page: page - 1 })}`,
		});
	}

	if (page < totalPages) {
		links.push({
			rel: ["next"],
			href: `/api/articles${buildQueryString({ ...queryParams, page: page + 1 })}`,
		});
	}

	return {
		class: ["collection", "articles"],
		properties: {
			total,
			page,
			pageSize,
		},
		entities: articles.map(toArticleSubEntity),
		links,
		actions: [
			{
				name: "save-article",
				href: "/api/articles",
				method: "POST",
				type: "application/json",
				fields: [{ name: "url", type: "url" }],
			},
			{
				name: "filter-by-status",
				href: "/api/articles",
				method: "GET",
				fields: [
					{ name: "status", type: "text" },
					{ name: "order", type: "text" },
					{ name: "page", type: "number" },
					{ name: "pageSize", type: "number" },
				],
			},
		],
	};
}
