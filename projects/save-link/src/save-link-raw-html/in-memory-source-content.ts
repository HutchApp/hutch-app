import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { PutSourceContent } from "./source-content.types";

export interface InMemorySourceContent {
	putSourceContent: PutSourceContent;
	readSourceContent: (params: { url: string; tier: string }) => string | undefined;
}

export function initInMemorySourceContent(): InMemorySourceContent {
	const store = new Map<string, string>();

	const putSourceContent: PutSourceContent = async (params) => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3SourceKey({ tier: params.tier });
		store.set(key, params.html);
	};

	const readSourceContent = (params: { url: string; tier: string }): string | undefined => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3SourceKey({ tier: params.tier });
		return store.get(key);
	};

	return { putSourceContent, readSourceContent };
}
