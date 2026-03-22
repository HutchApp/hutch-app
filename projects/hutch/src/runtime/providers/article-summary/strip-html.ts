import { parseHTML } from "linkedom";

function extractText(node: ChildNode): string {
	if (node.nodeType === 3) return node.textContent ?? "";
	return Array.from(node.childNodes).map(extractText).join(" ");
}

export function stripHtml(html: string): string {
	const { document } = parseHTML(`<div>${html}</div>`);
	const text = extractText(document.querySelector("div") ?? document.documentElement);
	return text.replace(/\s+/g, " ").trim();
}
