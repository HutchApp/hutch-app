import posthtml from "posthtml";
import urls from "@11ty/posthtml-urls";
import type { DownloadedMedia } from "./download-media";

export async function processContentWithLocalMedia(params: {
	html: string;
	thumbnailUrl: string | undefined;
	media: DownloadedMedia[];
}): Promise<{ html: string; thumbnailUrl: string | undefined }> {
	const { html, thumbnailUrl, media } = params;

	if (media.length === 0) {
		return { html, thumbnailUrl };
	}

	const cdnUrlsByOriginal = new Map(media.map((m) => [m.originalUrl, m.cdnUrl]));

	let imgSrcCdnUrl: string | undefined;

	const plugin = urls({ eachURL: rewriteUrl });
	/* c8 ignore next -- V8 async continuation branch on await */
	const result = await posthtml().use(plugin).process(html);

	function rewriteUrl(url: string, attr: string, tag: string): string {
		const cdnUrl = cdnUrlsByOriginal.get(url);

		if (tag === "img" && attr === "src") {
			imgSrcCdnUrl = cdnUrl;
		}

		if (attr === "srcset") {
			return cdnUrl || imgSrcCdnUrl || url;
		}

		return cdnUrl || url;
	}

	/* c8 ignore next 3 -- V8 block coverage phantom: ternary with || creates zero-count continuation block (bcoe/c8#319, v8.dev/blog/javascript-code-coverage) */
	const rewrittenThumbnail = thumbnailUrl
		? (cdnUrlsByOriginal.get(thumbnailUrl) || thumbnailUrl)
		: undefined;
	return { html: result.html, thumbnailUrl: rewrittenThumbnail }; /* c8 ignore next -- V8 async return branch */
}
