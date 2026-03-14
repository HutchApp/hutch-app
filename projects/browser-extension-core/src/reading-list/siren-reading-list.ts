import type {
	ReadingListItem,
	ReadingListItemId,
} from "../domain/reading-list-item.types";
import type {
	FindByUrl,
	GetAllItems,
	RemoveUrl,
	SaveUrl,
} from "./reading-list.types";

const SIREN_MEDIA_TYPE = "application/vnd.siren+json";

interface SirenSubEntity {
	properties?: Record<string, unknown>;
	actions?: Array<{ name: string; href: string; method: string }>;
}

interface SirenResponse {
	entities?: SirenSubEntity[];
}

export interface SirenReadingListDeps {
	serverUrl: string;
	getAccessToken: () => Promise<string | null>;
	fetchFn: typeof fetch;
}

function toReadingListItem(entity: SirenSubEntity): ReadingListItem {
	if (!entity.properties) {
		throw new Error("Server response entity missing properties");
	}
	const props = entity.properties;
	return {
		id: props.id as ReadingListItemId,
		url: props.url as string,
		title: props.title as string,
		savedAt: new Date(props.savedAt as string),
	};
}

export function initSirenReadingList(deps: SirenReadingListDeps): {
	saveUrl: SaveUrl;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
} {
	async function authHeaders(): Promise<Record<string, string>> {
		const token = await deps.getAccessToken();
		return {
			Authorization: `Bearer ${token}`,
			Accept: SIREN_MEDIA_TYPE,
		};
	}

	const saveUrl: SaveUrl = async ({ url }) => {
		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}/queue`, {
			method: "POST",
			headers: { ...headers, "Content-Type": "application/json" },
			body: JSON.stringify({ url }),
		});

		if (!response.ok) {
			throw new Error(`Save failed: ${response.status}`);
		}

		const body = await response.json() as SirenSubEntity;
		return { ok: true, item: toReadingListItem(body) };
	};

	const removeUrl: RemoveUrl = async (id) => {
		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}/queue/${id}/delete`, {
			method: "POST",
			headers,
		});

		if (response.status === 204) {
			return { ok: true };
		}

		return { ok: false, reason: "not-found" };
	};

	const findByUrl: FindByUrl = async (url) => {
		const headers = await authHeaders();
		const encoded = encodeURIComponent(url);
		const response = await deps.fetchFn(`${deps.serverUrl}/queue?url=${encoded}`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			return null;
		}

		const body = await response.json() as SirenResponse;
		const entities = body.entities ?? [];

		if (entities.length === 0) {
			return null;
		}

		return toReadingListItem(entities[0]);
	};

	const getAllItems: GetAllItems = async () => {
		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}/queue`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Fetch failed: ${response.status}`);
		}

		const body = await response.json() as SirenResponse;
		return (body.entities ?? []).map(toReadingListItem);
	};

	return { saveUrl, removeUrl, findByUrl, getAllItems };
}
