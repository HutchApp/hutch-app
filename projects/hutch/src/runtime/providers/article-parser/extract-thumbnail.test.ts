import { extractThumbnail } from "./extract-thumbnail";

describe("extractThumbnail", () => {
	it("should extract og:image when property comes before content", () => {
		const html = `<html><head>
			<meta property="og:image" content="https://example.com/og.jpg">
		</head><body></body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/og.jpg");
	});

	it("should extract og:image when content comes before property", () => {
		const html = `<html><head>
			<meta content="https://example.com/og.jpg" property="og:image">
		</head><body></body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/og.jpg");
	});

	it("should extract twitter:image when og:image is absent", () => {
		const html = `<html><head>
			<meta name="twitter:image" content="https://example.com/twitter.jpg">
		</head><body></body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/twitter.jpg");
	});

	it("should prefer og:image over twitter:image", () => {
		const html = `<html><head>
			<meta property="og:image" content="https://example.com/og.jpg">
			<meta name="twitter:image" content="https://example.com/twitter.jpg">
		</head><body></body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/og.jpg");
	});

	it("should fall back to first img tag when no meta tags exist", () => {
		const html = `<html><body>
			<img src="https://example.com/photo.jpg" alt="Photo">
			<img src="https://example.com/second.jpg" alt="Second">
		</body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/photo.jpg");
	});

	it("should prefer og:image over img tags", () => {
		const html = `<html><head>
			<meta property="og:image" content="https://example.com/og.jpg">
		</head><body>
			<img src="https://example.com/photo.jpg">
		</body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/og.jpg");
	});

	it("should return undefined when no images exist", () => {
		const html = "<html><head></head><body><p>No images here</p></body></html>";

		expect(extractThumbnail(html)).toBeUndefined();
	});

	it("should handle single-quoted attributes", () => {
		const html = `<html><head>
			<meta property='og:image' content='https://example.com/og.jpg'>
		</head><body></body></html>`;

		expect(extractThumbnail(html)).toBe("https://example.com/og.jpg");
	});
});
