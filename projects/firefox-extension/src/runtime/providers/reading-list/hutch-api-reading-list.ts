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

interface HutchApiReadingListDeps {
	serverUrl: string;
	getAccessToken: () => string | null;
	fetchFn: typeof fetch;
}

export function initHutchApiReadingList(deps: HutchApiReadingListDeps): {
	saveUrl: SaveUrl;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
} {
	const { serverUrl, getAccessToken, fetchFn } = deps;

	function authHeaders(): Record<string, string> {
		const token = getAccessToken();
		if (!token) return {};
		return { Authorization: `Bearer ${token}` };
	}

	const saveUrl: SaveUrl = async ({ url, title }) => {
		const response = await fetchFn(`${serverUrl}/api/articles`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(),
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

		const body = await response.json();
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
			headers: authHeaders(),
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
			{ headers: authHeaders() },
		);

		if (!response.ok) return null;

		const body = await response.json();
		if (!body) return null;

		return {
			id: body.id as ReadingListItemId,
			url: body.url,
			title: body.title,
			savedAt: new Date(body.savedAt),
		};
	};

	const getAllItems: GetAllItems = async () => {
		const response = await fetchFn(`${serverUrl}/api/articles`, {
			headers: authHeaders(),
		});

		if (!response.ok) {
			throw new Error(`Get all items failed: ${response.status}`);
		}

		const body: Array<{
			id: string;
			url: string;
			title: string;
			savedAt: string;
		}> = await response.json();

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
