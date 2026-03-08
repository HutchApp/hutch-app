import { z } from "zod";
import type {
	ReadingListItem,
	ReadingListItemId,
} from "../../domain/reading-list-item.types";
import type {
	FindByUrl,
	GetAllItems,
	RemoveUrl,
	SaveUrl,
} from "./reading-list.types";

const ArticleSchema = z.object({
	id: z.string(),
	url: z.string(),
	title: z.string(),
	savedAt: z.string(),
});

const ArticleListSchema = z.array(ArticleSchema);

interface HutchApiReadingListDeps {
	serverUrl: string;
	getAccessToken: () => Promise<string | null>;
	fetchFn: typeof fetch;
}

export function initHutchApiReadingList(deps: HutchApiReadingListDeps): {
	saveUrl: SaveUrl;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
} {
	const { serverUrl, getAccessToken, fetchFn } = deps;

	async function authHeaders(): Promise<Record<string, string>> {
		const token = await getAccessToken();
		if (!token) return {};
		return { Authorization: `Bearer ${token}` };
	}

	const saveUrl: SaveUrl = async ({ url, title }) => {
		const response = await fetchFn(`${serverUrl}/api/articles`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(await authHeaders()),
			},
			body: JSON.stringify({ url, title }),
		});

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			if (body.reason === "already-saved") {
				return { ok: false, reason: "already-saved" };
			}
			throw new Error(`Save failed: ${response.status}`);
		}

		const body = ArticleSchema.parse(await response.json());
		return {
			ok: true,
			item: {
				id: body.id as ReadingListItemId,
				url: body.url,
				title: body.title,
				savedAt: new Date(body.savedAt),
			},
		};
	};

	const removeUrl: RemoveUrl = async (id) => {
		const response = await fetchFn(`${serverUrl}/api/articles/${id}`, {
			method: "DELETE",
			headers: await authHeaders(),
		});

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			if (body.reason === "not-found") {
				return { ok: false, reason: "not-found" };
			}
			throw new Error(`Remove failed: ${response.status}`);
		}

		return { ok: true };
	};

	const findByUrl: FindByUrl = async (url) => {
		const params = new URLSearchParams({ url });
		const response = await fetchFn(
			`${serverUrl}/api/articles/find?${params.toString()}`,
			{ headers: await authHeaders() },
		);

		if (!response.ok) return null;

		const body = await response.json();
		if (!body) return null;

		const article = ArticleSchema.parse(body);
		return {
			id: article.id as ReadingListItemId,
			url: article.url,
			title: article.title,
			savedAt: new Date(article.savedAt),
		};
	};

	const getAllItems: GetAllItems = async () => {
		const response = await fetchFn(`${serverUrl}/api/articles`, {
			headers: await authHeaders(),
		});

		if (!response.ok) {
			throw new Error(`Get all items failed: ${response.status}`);
		}

		const body = ArticleListSchema.parse(await response.json());

		return body.map(
			(item): ReadingListItem => ({
				id: item.id as ReadingListItemId,
				url: item.url,
				title: item.title,
				savedAt: new Date(item.savedAt),
			}),
		);
	};

	return {
		saveUrl,
		removeUrl,
		findByUrl,
		getAllItems,
	};
}
