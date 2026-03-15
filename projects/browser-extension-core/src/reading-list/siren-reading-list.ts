import { z } from "zod";
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

// Cannot use node:assert in browser bundles — this minimal assert
// provides the same asserts-value narrowing for runtime invariants.
function assert(value: unknown, message: string): asserts value {
	if (!value) throw new Error(message);
}

const SirenPropertiesSchema = z.object({
	id: z.string(),
	url: z.string(),
	title: z.string(),
	savedAt: z.string(),
});

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
	assert(entity.properties, "Server response entity missing properties");
	const props = SirenPropertiesSchema.parse(entity.properties);
	return {
		id: props.id as ReadingListItemId,
		url: props.url,
		title: props.title,
		savedAt: new Date(props.savedAt),
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
		assert(token, "No access token available");
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
