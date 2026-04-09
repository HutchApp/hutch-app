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

	const rewrittenThumbnail = thumbnailUrl
		? (cdnUrlsByOriginal.get(thumbnailUrl) || thumbnailUrl)
		: undefined;

	let imgSrcCdnUrl: string | undefined;

	/* c8 ignore next -- V8 marks eachURL callback as uncovered (c8/Jest worker merge issue) */
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

	return { html: result.html, thumbnailUrl: rewrittenThumbnail }; /* c8 ignore next -- V8 async return branch */
}
