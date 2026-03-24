export function extractThumbnail(html: string, baseUrl?: string): string | undefined {
	const ogImage = matchMetaContent(html, "property", "og:image");
	const resolvedOg = resolveIfRelative(ogImage, baseUrl);
	if (resolvedOg && isValidHttpUrl(resolvedOg)) return resolvedOg;

	const twitterImage = matchMetaContent(html, "name", "twitter:image");
	const resolvedTwitter = resolveIfRelative(twitterImage, baseUrl);
	if (resolvedTwitter && isValidHttpUrl(resolvedTwitter)) return resolvedTwitter;

	const firstImg = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	const resolvedImg = resolveIfRelative(firstImg?.[1], baseUrl);
	if (resolvedImg && isValidHttpUrl(resolvedImg)) return resolvedImg;

	return undefined;
}

function resolveIfRelative(
	url: string | undefined,
	baseUrl: string | undefined,
): string | undefined {
	if (!url) return undefined;
	if (isValidHttpUrl(url)) return url;
	if (!baseUrl) return url;
	try {
		return new URL(url, baseUrl).href;
	} catch {
		return url;
	}
}

function isValidHttpUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

function matchMetaContent(
	html: string,
	attrName: string,
	attrValue: string,
): string | undefined {
	const attrFirst = new RegExp(
		`<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["']`,
		"i",
	);
	const contentFirst = new RegExp(
		`<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attrValue}["']`,
		"i",
	);

	const match = html.match(attrFirst) || html.match(contentFirst);
	return match?.[1];
}
