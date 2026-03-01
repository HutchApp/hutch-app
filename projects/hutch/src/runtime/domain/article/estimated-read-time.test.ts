import { calculateReadTime } from "./estimated-read-time";

describe("calculateReadTime", () => {
	it("should return 1 minute for 0 words", () => {
		expect(calculateReadTime(0)).toBe(1);
	});

	it("should return 1 minute for negative word count", () => {
		expect(calculateReadTime(-100)).toBe(1);
	});

	it("should return 1 minute for exactly 238 words", () => {
		expect(calculateReadTime(238)).toBe(1);
	});

	it("should return 2 minutes for 239 words", () => {
		expect(calculateReadTime(239)).toBe(2);
	});

	it("should return 5 minutes for 1190 words", () => {
		expect(calculateReadTime(1190)).toBe(5);
	});

	it("should round up to the nearest minute", () => {
		expect(calculateReadTime(500)).toBe(3);
	});
});
