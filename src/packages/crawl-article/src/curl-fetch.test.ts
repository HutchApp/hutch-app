import { parseCurlOutput } from "./curl-fetch";

describe("parseCurlOutput", () => {
	it("parses a simple 200 response with headers and body", () => {
		const raw = Buffer.from(
			"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\nserver: nginx\r\n\r\n<html>hello</html>",
		);
		const { status, headers, body } = parseCurlOutput(raw);
		expect(status).toBe(200);
		expect(headers.get("content-type")).toBe("text/html");
		expect(headers.get("server")).toBe("nginx");
		expect(body.toString()).toBe("<html>hello</html>");
	});

	it("parses the final response after a redirect chain", () => {
		const raw = Buffer.from(
			[
				"HTTP/1.1 301 Moved Permanently\r\nlocation: /new-path\r\n\r\n",
				"HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<html>final</html>",
			].join(""),
		);
		const { status, headers, body } = parseCurlOutput(raw);
		expect(status).toBe(200);
		expect(headers.get("content-type")).toBe("text/html");
		expect(body.toString()).toBe("<html>final</html>");
	});

	it("parses a 403 response", () => {
		const raw = Buffer.from(
			"HTTP/2 403 \r\nserver: cloudflare\r\n\r\nForbidden",
		);
		const { status, headers, body } = parseCurlOutput(raw);
		expect(status).toBe(403);
		expect(headers.get("server")).toBe("cloudflare");
		expect(body.toString()).toBe("Forbidden");
	});

	it("handles empty body", () => {
		const raw = Buffer.from("HTTP/1.1 204 No Content\r\n\r\n");
		const { status, body } = parseCurlOutput(raw);
		expect(status).toBe(204);
		expect(body.length).toBe(0);
	});

	it("handles binary body content", () => {
		const headerPart = "HTTP/1.1 200 OK\r\ncontent-type: image/png\r\n\r\n";
		const binaryBody = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
		const raw = Buffer.concat([Buffer.from(headerPart), binaryBody]);
		const { status, body } = parseCurlOutput(raw);
		expect(status).toBe(200);
		expect(body).toEqual(binaryBody);
	});
});
