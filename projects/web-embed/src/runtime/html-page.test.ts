import { HtmlPage } from "./html-page";

describe("HtmlPage", () => {
	it("should return 200 with the body when asked for text/html", () => {
		const result = HtmlPage("<p>Hello</p>").to("text/html");
		expect(result.statusCode).toBe(200);
		expect(result.body).toBe("<p>Hello</p>");
	});
});
