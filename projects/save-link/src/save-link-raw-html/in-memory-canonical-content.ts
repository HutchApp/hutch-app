import assert from "node:assert";
import { ArticleResourceUniqueId } from "../save-link/article-resource-unique-id";
import type { CanonicalContent, ReadCanonicalContent } from "./canonical-content.types";
import type { PromoteSourceToCanonical } from "./promote-source.types";

export interface InMemoryCanonicalContent {
	readCanonicalContent: ReadCanonicalContent;
	promoteSourceToCanonical: PromoteSourceToCanonical;
	seedCanonical: (params: { url: string; html: string; metadata: CanonicalContent["metadata"] }) => void;
}

export function initInMemoryCanonicalContent(deps: {
	readSourceContent: (params: { url: string; tier: string }) => string | undefined;
}): InMemoryCanonicalContent {
	const store = new Map<string, CanonicalContent>();

	const readCanonicalContent: ReadCanonicalContent = async (params) => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3ContentKey();
		return store.get(key);
	};

	const promoteSourceToCanonical: PromoteSourceToCanonical = async (params) => {
		const html = deps.readSourceContent({ url: params.url, tier: params.tier });
		assert(html !== undefined, `cannot promote: no source HTML for ${params.url} at ${params.tier}`);
		const key = ArticleResourceUniqueId.parse(params.url).toS3ContentKey();
		store.set(key, {
			html,
			metadata: {
				title: params.metadata.title,
				wordCount: params.metadata.wordCount,
			},
		});
	};

	const seedCanonical: InMemoryCanonicalContent["seedCanonical"] = (params) => {
		const key = ArticleResourceUniqueId.parse(params.url).toS3ContentKey();
		store.set(key, { html: params.html, metadata: params.metadata });
	};

	return { readCanonicalContent, promoteSourceToCanonical, seedCanonical };
}
