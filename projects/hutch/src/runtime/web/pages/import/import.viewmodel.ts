import type { ImportSessionPage } from "../../../domain/import-session/import-session.types";
import { buildImportUrl } from "./import.url";

export interface ImportRowViewModel {
	readonly index: number;
	readonly url: string;
	readonly checked: boolean;
}

export interface ImportViewModel {
	readonly sessionId: string;
	readonly rows: readonly ImportRowViewModel[];
	readonly totalUrls: number;
	readonly totalSelected: number;
	readonly truncated: boolean;
	readonly currentPage: number;
	readonly totalPages: number;
	readonly prevUrl?: string;
	readonly nextUrl?: string;
	readonly commitUrl: string;
	readonly toggleUrl: string;
}

export function toImportViewModel(
	pageResult: ImportSessionPage,
	totalSelected: number,
): ImportViewModel {
	const { session, pageUrls, page, pageSize } = pageResult;
	const totalPages = Math.max(1, Math.ceil(session.totalUrls / pageSize));
	const start = (page - 1) * pageSize;
	const sessionId = session.id;
	return {
		sessionId,
		rows: pageUrls.map((url, i) => {
			const index = start + i;
			return {
				index,
				url,
				checked: !session.deselected.has(index),
			};
		}),
		totalUrls: session.totalUrls,
		totalSelected,
		truncated: session.truncated,
		currentPage: page,
		totalPages,
		prevUrl: page > 1 ? buildImportUrl(sessionId, page - 1) : undefined,
		nextUrl: page < totalPages ? buildImportUrl(sessionId, page + 1) : undefined,
		commitUrl: `/import/${sessionId}/commit`,
		toggleUrl: `/import/${sessionId}/toggle`,
	};
}
