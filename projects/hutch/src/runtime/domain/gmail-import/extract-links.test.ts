import { extractLinks } from "./extract-links";

describe("extractLinks", () => {
	it("extracts href values from anchor tags", () => {
		const html = '<html><body><a href="https://example.com">Link</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual(["https://example.com"]);
	});

	it("extracts multiple links", () => {
		const html = `
			<html><body>
				<a href="https://one.com">One</a>
				<a href="https://two.com">Two</a>
				<a href="https://three.com">Three</a>
			</body></html>
		`;

		const links = extractLinks(html);

		expect(links).toEqual(["https://one.com", "https://two.com", "https://three.com"]);
	});

	it("deduplicates identical URLs", () => {
		const html = `
			<html><body>
				<a href="https://example.com">First</a>
				<a href="https://example.com">Second</a>
			</body></html>
		`;

		const links = extractLinks(html);

		expect(links).toEqual(["https://example.com"]);
	});

	it("ignores mailto: links", () => {
		const html = '<html><body><a href="mailto:user@example.com">Email</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("ignores javascript: links", () => {
		const html = '<html><body><a href="javascript:void(0)">Click</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("ignores tel: links", () => {
		const html = '<html><body><a href="tel:+1234567890">Call</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("ignores fragment-only links", () => {
		const html = '<html><body><a href="#">Top</a><a href="#section">Section</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("returns empty array for plain text with no links", () => {
		const html = "<html><body><p>No links here.</p></body></html>";

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("ignores anchors without href attribute", () => {
		const html = '<html><body><a name="bookmark">Anchor</a></body></html>';

		const links = extractLinks(html);

		expect(links).toEqual([]);
	});

	it("handles empty HTML string", () => {
		const links = extractLinks("");

		expect(links).toEqual([]);
	});
});
