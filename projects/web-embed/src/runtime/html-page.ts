import type { Component } from "./component.types";

export function HtmlPage(body: string): Component {
	return {
		to: () => ({ statusCode: 200, body }),
	};
}
