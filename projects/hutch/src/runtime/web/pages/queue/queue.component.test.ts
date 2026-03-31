import { formatUnreadLabel } from "./queue.component";

describe("formatUnreadLabel", () => {
	it("should format zero count", () => {
		expect(formatUnreadLabel(0)).toBe("Unread (0)");
	});

	it("should format normal count", () => {
		expect(formatUnreadLabel(5)).toBe("Unread (5)");
	});

	it("should format count at boundary", () => {
		expect(formatUnreadLabel(99)).toBe("Unread (99)");
	});

	it("should cap at 99+ when count exceeds 99", () => {
		expect(formatUnreadLabel(100)).toBe("Unread (99+)");
	});
});
