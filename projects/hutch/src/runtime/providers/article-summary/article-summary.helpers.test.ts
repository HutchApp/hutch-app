import { pickExcerpt, truncateForSeo } from "./article-summary.helpers";

describe("pickExcerpt", () => {
	it("returns the summary text when status is ready", () => {
		expect(
			pickExcerpt(
				{ status: "ready", summary: "AI-generated summary." },
				"Parsed excerpt.",
			),
		).toBe("AI-generated summary.");
	});

	it("returns the fallback when summary is undefined", () => {
		expect(pickExcerpt(undefined, "Parsed excerpt.")).toBe("Parsed excerpt.");
	});

	it("returns the fallback when status is pending", () => {
		expect(pickExcerpt({ status: "pending" }, "Parsed excerpt.")).toBe(
			"Parsed excerpt.",
		);
	});

	it("returns the fallback when status is failed", () => {
		expect(
			pickExcerpt({ status: "failed", reason: "boom" }, "Parsed excerpt."),
		).toBe("Parsed excerpt.");
	});

	it("returns the fallback when status is skipped", () => {
		expect(pickExcerpt({ status: "skipped" }, "Parsed excerpt.")).toBe(
			"Parsed excerpt.",
		);
	});
});

describe("truncateForSeo", () => {
	it("returns the text unchanged when within the limit", () => {
		expect(truncateForSeo("Short and sweet.")).toBe("Short and sweet.");
	});

	it("returns the text unchanged when exactly at the limit", () => {
		const text = "a".repeat(160);
		expect(truncateForSeo(text)).toBe(text);
	});

	it("truncates at the last word boundary and appends an ellipsis", () => {
		const long = `${"word ".repeat(40)}tail`;
		const result = truncateForSeo(long);

		expect(result.length).toBeLessThanOrEqual(160);
		expect(result.endsWith("…")).toBe(true);
		expect(result).not.toMatch(/ …$/);
	});

	it("hard-cuts when the slice has no whitespace", () => {
		const noSpaces = "x".repeat(200);
		const result = truncateForSeo(noSpaces);

		expect(result).toBe(`${"x".repeat(159)}…`);
	});

	it("respects a custom maxChars argument", () => {
		expect(truncateForSeo("hello world there", 11)).toBe("hello…");
	});
});
