import { ArticleUniqueId } from "@packages/article-unique-id";

export type ContentProvider = (articleUniqueId: ArticleUniqueId) => Promise<string | undefined>;

export type ReadArticleContent = (url: string) => Promise<string | undefined>;

export function initReadArticleContent(deps: {
	storageProviderQueryOrder: ContentProvider[];
	logError: (message: string, error?: Error) => void;
}): ReadArticleContent {
	const { storageProviderQueryOrder, logError } = deps;

	return async (url) => {
		const articleUniqueId = ArticleUniqueId.parse(url);

		for (const provider of storageProviderQueryOrder) {
			try {
				const content = await provider(articleUniqueId);
				if (content) return content;
			} catch (error) {
				logError("Content provider failed, trying next", error instanceof Error ? error : undefined);
			}
		}

		return undefined;
	};
}
