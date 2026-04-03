import { parseHTML } from "linkedom";

const IGNORED_PROTOCOLS = new Set(["mailto:", "javascript:", "tel:", "data:"]);

export function extractLinks(html: string): string[] {
	const { document } = parseHTML(html);
	const anchors = document.querySelectorAll("a[href]");
	const seen = new Set<string>();
	const links: string[] = [];

	for (const anchor of anchors) {
		const href = anchor.getAttribute("href")?.trim();
		if (!href || href === "#" || href.startsWith("#")) continue;

		const protocol = `${href.split(":")[0]}:`;
		if (IGNORED_PROTOCOLS.has(protocol.toLowerCase())) continue;

		if (!seen.has(href)) {
			seen.add(href);
			links.push(href);
		}
	}

	return links;
}
