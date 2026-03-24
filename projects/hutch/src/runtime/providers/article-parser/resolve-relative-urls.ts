import { parseHTML } from "linkedom";

export function resolveRelativeUrls(params: {
	html: string;
	baseUrl: string;
}): string {
	if (!params.html) return params.html;

	const { document } = parseHTML(`<div id="root">${params.html}</div>`);
	const base = new URL(params.baseUrl);

	for (const img of document.querySelectorAll("img[src], video[src], audio[src]")) {
		resolveAttribute(img, "src", base);
	}

	for (const a of document.querySelectorAll("a[href]")) {
		const href = a.getAttribute("href");
		if (href && href.startsWith("#")) continue;
		resolveAttribute(a, "href", base);
	}

	for (const source of document.querySelectorAll("source[srcset]")) {
		resolveAttribute(source, "srcset", base);
	}

	return document.getElementById("root")?.innerHTML ?? params.html;
}

function resolveAttribute(
	element: Element,
	attribute: string,
	base: URL,
): void {
	const value = element.getAttribute(attribute);
	if (!value) return;

	try {
		const resolved = new URL(value, base.href).href;
		element.setAttribute(attribute, resolved);
	} catch {
		// leave malformed URLs as-is
	}
}
