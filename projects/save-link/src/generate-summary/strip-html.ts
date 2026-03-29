import { parseHTML } from "linkedom";

function extractText(node: { nodeType: number; textContent: string | null; childNodes: Iterable<unknown> }): string {
	if (node.nodeType === 3) return node.textContent ?? "";
	return Array.from(node.childNodes).map((child) => extractText(child as typeof node)).join(" ");
}

export function stripHtml(html: string): string {
	const { document } = parseHTML(`<div>${html}</div>`);
	const text = extractText(document.querySelector("div") ?? document.documentElement);
	return text.replace(/\s+/g, " ").trim();
}
