import { HtmlPage } from "./html-page";
import type { SupportedMediaType } from "./component.types";

describe("HtmlPage", () => {
	it("returns 200 with the body for text/html", () => {
		const result = HtmlPage("<p>Hello</p>").to("text/html");

		expect(result.statusCode).toBe(200);
		expect(result.body).toBe("<p>Hello</p>");
	});

	it("returns 415 with empty body for unsupported media types", () => {
		const result = HtmlPage("<p>Hello</p>").to("application/vnd.siren+json" as SupportedMediaType);

		expect(result.statusCode).toBe(415);
		expect(result.body).toBe("");
	});
});
