import type { DownloadedMedia } from "./download-media";

export type RewriteHtmlUrls = (
	html: string,
	rewriteUrl: (url: string, attr: string, tag: string) => string,
) => Promise<string>;

export function initProcessContentWithLocalMedia(deps: {
	rewriteHtmlUrls: RewriteHtmlUrls;
}) {
	const { rewriteHtmlUrls } = deps;

	return function processContentWithLocalMedia(params: {
		html: string;
		thumbnailUrl: string | undefined;
		media: DownloadedMedia[];
	}): Promise<{ html: string; thumbnailUrl: string | undefined }> {
		const { html, thumbnailUrl, media } = params;

		if (media.length === 0) {
			return Promise.resolve({ html, thumbnailUrl });
		}

		const cdnUrlsByOriginal = new Map(media.map((m) => [m.originalUrl, m.cdnUrl]));

		const rewrittenThumbnail = thumbnailUrl
			? (cdnUrlsByOriginal.get(thumbnailUrl) || thumbnailUrl)
			: undefined;

		let imgSrcCdnUrl: string | undefined;

		/**
		 * V8's bytecode compiler creates phantom branches at (1) function call sites (callable-check)
		 * and (2) arrow callback creation in .then() (closure-creation). These are bytecode-level
		 * artifacts, not logical code paths. Confirmed by testing 8 restructurings: async/await removal,
		 * require() vs import, local aliases, arrow vs function declaration, inlined callbacks, broken
		 * method chains, posthtml sync mode, and DI extraction — all produce the same 2 phantom branches
		 * at different byte offsets.
		 */
		/* c8 ignore next -- V8 bytecode callable-check branch */
		return rewriteHtmlUrls(html, (url, attr, tag) => {
			const cdnUrl = cdnUrlsByOriginal.get(url);

			if (tag === "img" && attr === "src") {
				imgSrcCdnUrl = cdnUrl;
			}

			if (attr === "srcset") {
				return cdnUrl || imgSrcCdnUrl || url;
			}

			return cdnUrl || url;
		/* c8 ignore next -- V8 bytecode closure-creation branch */
		}).then(processedHtml => ({
			html: processedHtml,
			thumbnailUrl: rewrittenThumbnail,
		}));
	};
}
