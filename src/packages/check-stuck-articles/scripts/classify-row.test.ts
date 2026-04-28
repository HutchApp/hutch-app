import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyRow } from "./classify-row";

describe("classifyRow", () => {
	describe("summaryStatus", () => {
		it("returns summary-pending for pending", () => {
			const reasons = classifyRow({ summaryStatus: "pending", crawlStatus: "ready", summary: undefined });
			assert.deepStrictEqual(reasons, ["summary-pending"]);
		});

		it("returns summary-failed for failed", () => {
			const reasons = classifyRow({ summaryStatus: "failed", crawlStatus: "ready", summary: undefined });
			assert.deepStrictEqual(reasons, ["summary-failed"]);
		});

		it("returns no reason for ready", () => {
			const reasons = classifyRow({ summaryStatus: "ready", crawlStatus: "ready", summary: undefined });
			assert.deepStrictEqual(reasons, []);
		});

		it("returns no reason for skipped", () => {
			const reasons = classifyRow({ summaryStatus: "skipped", crawlStatus: "ready", summary: undefined });
			assert.deepStrictEqual(reasons, []);
		});
	});

	describe("crawlStatus", () => {
		it("returns crawl-pending for pending", () => {
			const reasons = classifyRow({ summaryStatus: "ready", crawlStatus: "pending", summary: undefined });
			assert.deepStrictEqual(reasons, ["crawl-pending"]);
		});

		it("returns crawl-failed for failed", () => {
			const reasons = classifyRow({ summaryStatus: "ready", crawlStatus: "failed", summary: undefined });
			assert.deepStrictEqual(reasons, ["crawl-failed"]);
		});

		it("returns no reason for ready", () => {
			const reasons = classifyRow({ summaryStatus: "ready", crawlStatus: "ready", summary: undefined });
			assert.deepStrictEqual(reasons, []);
		});
	});

	describe("combined statuses", () => {
		it("returns both reasons when summary and crawl are pending", () => {
			const reasons = classifyRow({ summaryStatus: "pending", crawlStatus: "pending", summary: undefined });
			assert.deepStrictEqual(reasons, ["summary-pending", "crawl-pending"]);
		});

		it("returns both reasons when summary and crawl are failed", () => {
			const reasons = classifyRow({ summaryStatus: "failed", crawlStatus: "failed", summary: undefined });
			assert.deepStrictEqual(reasons, ["summary-failed", "crawl-failed"]);
		});
	});

	describe("legacy stub", () => {
		it("returns legacy-stub when all fields are undefined", () => {
			const reasons = classifyRow({ summaryStatus: undefined, crawlStatus: undefined, summary: undefined });
			assert.deepStrictEqual(reasons, ["legacy-stub"]);
		});

		it("returns no reason when summary exists but statuses are undefined", () => {
			const reasons = classifyRow({ summaryStatus: undefined, crawlStatus: undefined, summary: "some text" });
			assert.deepStrictEqual(reasons, []);
		});
	});
});
