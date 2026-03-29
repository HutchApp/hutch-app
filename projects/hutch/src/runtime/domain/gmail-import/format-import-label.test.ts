import { formatImportLabelName } from "./gmail-import.types";

describe("formatImportLabelName", () => {
	it("formats a date as imported-by-hutch-DD-MMM-YY", () => {
		const date = new Date("2026-03-28T12:00:00Z");

		const label = formatImportLabelName(date);

		expect(label).toBe("imported-by-hutch-28-MAR-26");
	});

	it("pads single-digit days with a leading zero", () => {
		const date = new Date("2026-01-05T12:00:00Z");

		const label = formatImportLabelName(date);

		expect(label).toBe("imported-by-hutch-05-JAN-26");
	});

	it("handles December correctly", () => {
		const date = new Date("2025-12-31T12:00:00Z");

		const label = formatImportLabelName(date);

		expect(label).toBe("imported-by-hutch-31-DEC-25");
	});
});
