import { normalizeArticleUrl } from "../../domain/article/normalize-article-url";

export type ContentProvider = (normalizedUrl: string) => Promise<string | undefined>;

export type ReadArticleContent = (url: string) => Promise<string | undefined>;

export function initReadArticleContent(deps: {
	storageProviderQueryOrder: ContentProvider[];
	logError: (message: string, error?: Error) => void;
}): ReadArticleContent {
	const { storageProviderQueryOrder, logError } = deps;

	return async (url) => {
		const normalizedUrl = normalizeArticleUrl(url);

		for (const provider of storageProviderQueryOrder) {
			try {
				const content = await provider(normalizedUrl);
				if (content) return content;
			} catch (error) {
				logError("Content provider failed, trying next", error instanceof Error ? error : undefined);
			}
		}

		return undefined;
	};
}
