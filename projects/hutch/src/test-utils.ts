import { JSDOM } from "jsdom";

export function parseHTML(html: string): Document {
	const dom = new JSDOM(html);
	return dom.window.document;
}
