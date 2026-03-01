export function extractThumbnail(html: string): string | undefined {
	const ogImage = matchMetaContent(html, "property", "og:image");
	if (ogImage) return ogImage;

	const twitterImage = matchMetaContent(html, "name", "twitter:image");
	if (twitterImage) return twitterImage;

	const firstImg = html.match(/<img[^>]+src=["']([^"']+)["']/i);
	if (firstImg) return firstImg[1];

	return undefined;
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
