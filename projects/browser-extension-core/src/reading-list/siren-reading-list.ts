import "../zod-config";
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

interface SirenLink {
	rel: string[];
	href: string;
}

interface SirenAction {
	name: string;
	href: string;
	method: string;
	type?: string;
	fields?: Array<{ name: string; type: string }>;
}

interface SirenSubEntity {
	properties?: Record<string, unknown>;
	links?: SirenLink[];
	actions?: SirenAction[];
}

interface SirenCollectionResponse {
	class?: string[];
	properties?: Record<string, unknown>;
	entities?: SirenSubEntity[];
	links?: SirenLink[];
	actions?: SirenAction[];
}

export interface SirenReadingListDeps {
	serverUrl: string;
	getAccessToken: () => Promise<string | null>;
	fetchFn: typeof fetch;
}

function findLinkHref(entity: SirenSubEntity, rel: string): string | undefined {
	return entity.links?.find((link) => link.rel.includes(rel))?.href;
}

function findAction(actions: SirenAction[], name: string): SirenAction {
	const action = actions.find((a) => a.name === name);
	assert(action, `Expected Siren action "${name}" not found in response`);
	return action;
}

function toReadingListItem(entity: SirenSubEntity, serverUrl: string): ReadingListItem {
	assert(entity.properties, "Server response entity missing properties");
	const props = SirenPropertiesSchema.parse(entity.properties);
	const readHref = findLinkHref(entity, "read");
	return {
		// Zod validates id is a string; branded type narrowing is safe after schema validation
		id: props.id as ReadingListItemId,
		url: props.url,
		title: props.title,
		savedAt: new Date(props.savedAt),
		readUrl: readHref ? `${serverUrl}${readHref}` : undefined,
	};
}

export function initSirenReadingList(deps: SirenReadingListDeps): {
	saveUrl: SaveUrl;
	removeUrl: RemoveUrl;
	findByUrl: FindByUrl;
	getAllItems: GetAllItems;
} {
	let cachedActions: SirenAction[] | null = null;
	const deleteActions = new Map<string, SirenAction>();

	async function authHeaders(): Promise<Record<string, string>> {
		const token = await deps.getAccessToken();
		assert(token, "No access token available");
		return {
			Authorization: `Bearer ${token}`,
			Accept: SIREN_MEDIA_TYPE,
		};
	}

	async function getCollectionActions(): Promise<SirenAction[]> {
		if (cachedActions) return cachedActions;
		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}/queue`, {
			method: "GET",
			headers,
		});
		if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
		const body = await response.json() as SirenCollectionResponse;
		cachedActions = body.actions ?? [];
		return cachedActions;
	}

	function trackDeleteAction(entity: SirenSubEntity, itemId: string): void {
		const action = entity.actions?.find((a) => a.name === "delete");
		if (action) {
			deleteActions.set(itemId, action);
		}
	}

	const saveUrl: SaveUrl = async ({ url }) => {
		const actions = await getCollectionActions();
		const saveAction = findAction(actions, "save-article");
		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}${saveAction.href}`, {
			method: saveAction.method,
			headers: { ...headers, "Content-Type": saveAction.type ?? "application/json" },
			body: JSON.stringify({ url }),
		});

		if (!response.ok) {
			throw new Error(`Save failed: ${response.status}`);
		}

		const body = await response.json() as SirenSubEntity;
		const item = toReadingListItem(body, deps.serverUrl);
		trackDeleteAction(body, item.id);
		return { ok: true, item };
	};

	const removeUrl: RemoveUrl = async (id) => {
		let action = deleteActions.get(id);

		if (!action) {
			const headers = await authHeaders();
			const response = await deps.fetchFn(`${deps.serverUrl}/queue`, {
				method: "GET",
				headers,
			});
			if (response.ok) {
				const body = await response.json() as SirenCollectionResponse;
				for (const entity of body.entities ?? []) {
					if (entity.properties) {
						const props = SirenPropertiesSchema.safeParse(entity.properties);
						if (props.success) {
							trackDeleteAction(entity, props.data.id);
						}
					}
				}
				action = deleteActions.get(id);
			}
		}

		assert(action, `No delete action found for item ${id}`);

		const headers = await authHeaders();
		const response = await deps.fetchFn(`${deps.serverUrl}${action.href}`, {
			method: action.method,
			headers,
			redirect: "manual",
		});

		if (response.status === 204 || response.status === 303) {
			return { ok: true };
		}

		return { ok: false, reason: "not-found" };
	};

	const findByUrl: FindByUrl = async (url) => {
		const actions = await getCollectionActions();
		const filterAction = findAction(actions, "filter-by-status");
		const filterUrl = new URL(`${deps.serverUrl}${filterAction.href}`);
		filterUrl.searchParams.set("url", url);

		const headers = await authHeaders();
		const response = await deps.fetchFn(filterUrl.toString(), {
			method: filterAction.method,
			headers,
		});

		if (!response.ok) {
			return null;
		}

		const body = await response.json() as SirenCollectionResponse;
		const entities = body.entities ?? [];

		if (entities.length === 0) {
			return null;
		}

		const item = toReadingListItem(entities[0], deps.serverUrl);
		trackDeleteAction(entities[0], item.id);
		return item;
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

		const body = await response.json() as SirenCollectionResponse;
		cachedActions = body.actions ?? [];

		return (body.entities ?? []).map((entity) => {
			const item = toReadingListItem(entity, deps.serverUrl);
			trackDeleteAction(entity, item.id);
			return item;
		});
	};

	return { saveUrl, removeUrl, findByUrl, getAllItems };
}
