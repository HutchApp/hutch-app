import { buildQueueUrl, parseQueueUrl } from "./queue.url";

describe("parseQueueUrl", () => {
	it("should return defaults for empty query", () => {
		const state = parseQueueUrl({});
		expect(state).toEqual({ status: undefined, starred: undefined, order: "desc", page: 1 });
	});

	it("should parse valid status", () => {
		expect(parseQueueUrl({ status: "read" }).status).toBe("read");
		expect(parseQueueUrl({ status: "unread" }).status).toBe("unread");
		expect(parseQueueUrl({ status: "archived" }).status).toBe("archived");
	});

	it("should ignore invalid status", () => {
		expect(parseQueueUrl({ status: "invalid" }).status).toBeUndefined();
	});

	it("should parse starred filter", () => {
		expect(parseQueueUrl({ starred: "true" }).starred).toBe(true);
		expect(parseQueueUrl({ starred: "false" }).starred).toBe(false);
	});

	it("should parse order", () => {
		expect(parseQueueUrl({ order: "asc" }).order).toBe("asc");
		expect(parseQueueUrl({ order: "desc" }).order).toBe("desc");
	});

	it("should default to desc for invalid order", () => {
		expect(parseQueueUrl({ order: "invalid" }).order).toBe("desc");
	});

	it("should parse page number", () => {
		expect(parseQueueUrl({ page: "3" }).page).toBe(3);
	});

	it("should default to page 1 for invalid page", () => {
		expect(parseQueueUrl({ page: "-1" }).page).toBe(1);
		expect(parseQueueUrl({ page: "abc" }).page).toBe(1);
		expect(parseQueueUrl({ page: "0" }).page).toBe(1);
	});

	it("should parse showUrl flag", () => {
		expect(parseQueueUrl({ showUrl: "true" }).showUrl).toBe(true);
	});

	it("should default showUrl to undefined when not set", () => {
		expect(parseQueueUrl({}).showUrl).toBeUndefined();
	});

	it("should ignore invalid showUrl values", () => {
		expect(parseQueueUrl({ showUrl: "false" }).showUrl).toBeUndefined();
		expect(parseQueueUrl({ showUrl: "yes" }).showUrl).toBeUndefined();
	});
});

describe("buildQueueUrl", () => {
	it("should return /queue for defaults", () => {
		expect(buildQueueUrl({})).toBe("/queue");
	});

	it("should include status", () => {
		expect(buildQueueUrl({ status: "read" })).toBe("/queue?status=read");
	});

	it("should include starred", () => {
		expect(buildQueueUrl({ starred: true })).toBe("/queue?starred=true");
	});

	it("should omit default order (desc)", () => {
		expect(buildQueueUrl({ order: "desc" })).toBe("/queue");
	});

	it("should include non-default order", () => {
		expect(buildQueueUrl({ order: "asc" })).toBe("/queue?order=asc");
	});

	it("should omit page 1", () => {
		expect(buildQueueUrl({ page: 1 })).toBe("/queue");
	});

	it("should include page > 1", () => {
		expect(buildQueueUrl({ page: 2 })).toBe("/queue?page=2");
	});

	it("should combine multiple params", () => {
		const url = buildQueueUrl({ status: "unread", order: "asc", page: 3 });
		expect(url).toContain("status=unread");
		expect(url).toContain("order=asc");
		expect(url).toContain("page=3");
	});

	it("should include showUrl when true", () => {
		expect(buildQueueUrl({ showUrl: true })).toBe("/queue?showUrl=true");
	});

	it("should omit showUrl when not set", () => {
		expect(buildQueueUrl({})).toBe("/queue");
	});
});
