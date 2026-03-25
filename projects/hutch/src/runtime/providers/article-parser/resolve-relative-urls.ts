import assert from "node:assert";
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

	for (const el of document.querySelectorAll("[srcset]")) {
		resolveSrcset(el, base);
	}

	const root = document.getElementById("root");
	assert(root, "Root element must exist");
	return root.innerHTML;
}

function resolveSrcset(element: Element, base: URL): void {
	const value = element.getAttribute("srcset");
	if (!value) return;

	const resolved = value
		.split(",")
		.map((entry) => {
			const trimmed = entry.trim();
			const spaceIndex = trimmed.search(/\s/);
			if (spaceIndex === -1) {
				try {
					return new URL(trimmed, base.href).href;
				} catch {
					return trimmed;
				}
			}
			const url = trimmed.slice(0, spaceIndex);
			const descriptor = trimmed.slice(spaceIndex);
			try {
				return new URL(url, base.href).href + descriptor;
			} catch {
				return trimmed;
			}
		})
		.join(", ");

	element.setAttribute("srcset", resolved);
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
