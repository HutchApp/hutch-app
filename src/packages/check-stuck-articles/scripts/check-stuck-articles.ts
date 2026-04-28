#!/usr/bin/env node
/**
 * Stuck-articles canary.
 *
 * Read-only DDB scan: returns one failing node:test sub-test per article
 * whose state machines never reached a terminal-good state. Zero stuck
 * rows = green. Replaces /tmp/list-stuck-articles.sh — same FilterExpression
 * and same exclude-regex semantics, but the classifier and the Zod schemas
 * are bound to @packages/article-state-types so a new summaryStatus or
 * crawlStatus value upstream fails `tsc --noEmit` immediately, instead of
 * producing a quiet false-negative on tomorrow's cron.
 *
 * Required env:
 *   - AWS_REGION
 *   - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (the SDK reads these directly)
 *   - DYNAMODB_ARTICLES_TABLE
 *
 * Optional env:
 *   - READPLACE_ORIGIN (defaults to https://readplace.com — used to build
 *     admin recrawl URLs in the failing-test message for each stuck row)
 *
 * Run via: pnpm nx run @packages/check-stuck-articles:check-stuck-articles
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	type CrawlStatus,
	CrawlStatusSchema,
	type SummaryStatus,
	SummaryStatusSchema,
} from "@packages/article-state-types";
import {
	createDynamoDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { EXCLUDE_PATTERNS } from "./exclude-patterns";

function requireEnv(name: string): string {
	const value = process.env[name];
	assert(value, `${name} env var is required`);
	return value;
}

const REGION = requireEnv("AWS_REGION");
const TABLE = requireEnv("DYNAMODB_ARTICLES_TABLE");
const ORIGIN = process.env.READPLACE_ORIGIN ?? "https://readplace.com";

/**
 * Loose row schema for the canary's projection. Every attribute except `url`
 * is wrapped in `dynamoField` so absent attributes (which DDB returns as
 * `null`) are normalised to `undefined`. The status enums are imported from
 * @packages/article-state-types so adding a new status to the production
 * schemas surfaces here as a tsc error in `classifyRow`.
 */
const StuckArticleRow = z.object({
	url: z.string(),
	originalUrl: dynamoField(z.string()),
	summaryStatus: dynamoField(SummaryStatusSchema),
	crawlStatus: dynamoField(CrawlStatusSchema),
	summaryFailureReason: dynamoField(z.string()),
	crawlFailureReason: dynamoField(z.string()),
	contentFetchedAt: dynamoField(z.string()),
	summary: dynamoField(z.string()),
});
type StuckArticleRow = z.infer<typeof StuckArticleRow>;

type StuckReason =
	| "summary-pending"
	| "summary-failed"
	| "crawl-pending"
	| "crawl-failed"
	| "legacy-stub";

/**
 * Map a row to the reasons it is "stuck". Empty array = the row is healthy
 * (terminal-good state machines, or a legacy row carrying a pre-state-machine
 * `summary`). The two switches use exhaustive `never` defaults so a new
 * SummaryStatus or CrawlStatus added to @packages/article-state-types breaks
 * `tsc --noEmit` until the classifier handles it.
 */
function classifyRow(
	row: Pick<StuckArticleRow, "summaryStatus" | "crawlStatus" | "summary">,
): StuckReason[] {
	const reasons: StuckReason[] = [];
	if (row.summaryStatus !== undefined) {
		switch (row.summaryStatus) {
			case "pending":
				reasons.push("summary-pending");
				break;
			case "failed":
				reasons.push("summary-failed");
				break;
			case "ready":
			case "skipped":
				break;
			default: {
				const _exhaustive: never = row.summaryStatus;
				throw new Error(
					`Unhandled summaryStatus '${String(_exhaustive satisfies SummaryStatus)}' — extend classifyRow.`,
				);
			}
		}
	}
	if (row.crawlStatus !== undefined) {
		switch (row.crawlStatus) {
			case "pending":
				reasons.push("crawl-pending");
				break;
			case "failed":
				reasons.push("crawl-failed");
				break;
			case "ready":
				break;
			default: {
				const _exhaustive: never = row.crawlStatus;
				throw new Error(
					`Unhandled crawlStatus '${String(_exhaustive satisfies CrawlStatus)}' — extend classifyRow.`,
				);
			}
		}
	}
	// Legacy stub: row predates both state machines AND has no pre-computed
	// summary. Such rows are visible to readers as a permanent loading spinner
	// because no worker will ever drive them forward.
	if (
		row.summaryStatus === undefined &&
		row.crawlStatus === undefined &&
		row.summary === undefined
	) {
		reasons.push("legacy-stub");
	}
	return reasons;
}

function isExcluded(url: string): boolean {
	return EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

interface StuckRow {
	originalUrl: string;
	reasons: StuckReason[];
	contentFetchedAt: string | undefined;
	failureReason: string | undefined;
	recrawlUrl: string;
}

async function collectStuckRows(): Promise<StuckRow[]> {
	const client = createDynamoDocumentClient({ region: REGION });
	const table = defineDynamoTable({
		client,
		tableName: TABLE,
		schema: StuckArticleRow,
	});
	const stuck: StuckRow[] = [];
	let skippedNoOriginal = 0;
	let excludedDomain = 0;
	let lastEvaluatedKey: Record<string, unknown> | undefined;
	do {
		const page = await table.scan({
			FilterExpression:
				"summaryStatus IN (:pending, :failed) " +
				"OR crawlStatus IN (:pending, :failed) " +
				"OR (attribute_not_exists(summaryStatus) AND attribute_not_exists(crawlStatus) AND attribute_not_exists(summary))",
			ProjectionExpression:
				"originalUrl, #u, summaryStatus, crawlStatus, summaryFailureReason, crawlFailureReason, contentFetchedAt, summary",
			ExpressionAttributeNames: { "#u": "url" },
			ExpressionAttributeValues: { ":pending": "pending", ":failed": "failed" },
			ExclusiveStartKey: lastEvaluatedKey,
		});
		for (const row of page.items) {
			const reasons = classifyRow(row);
			if (reasons.length === 0) continue;
			if (row.originalUrl === undefined) {
				skippedNoOriginal += 1;
				continue;
			}
			if (isExcluded(row.originalUrl)) {
				excludedDomain += 1;
				continue;
			}
			stuck.push({
				originalUrl: row.originalUrl,
				reasons,
				contentFetchedAt: row.contentFetchedAt,
				failureReason: row.summaryFailureReason ?? row.crawlFailureReason,
				recrawlUrl: `${ORIGIN}/admin/recrawl/${encodeURIComponent(row.originalUrl)}`,
			});
		}
		lastEvaluatedKey = page.lastEvaluatedKey;
	} while (lastEvaluatedKey !== undefined);
	if (skippedNoOriginal > 0) {
		process.stderr.write(`[info] skipped ${skippedNoOriginal} row(s) without originalUrl\n`);
	}
	if (excludedDomain > 0) {
		process.stderr.write(`[info] excluded ${excludedDomain} row(s) by domain filter\n`);
	}
	return stuck;
}

test("Stuck articles canary", async (t) => {
	const stuck = await collectStuckRows();
	for (const row of stuck) {
		const label = `[${row.reasons.join(",")}] ${row.originalUrl}`;
		await t.test(label, () => {
			assert.fail(
				`Stuck article — fetched: ${row.contentFetchedAt ?? "-"}; failure: ${row.failureReason ?? "-"}; recrawl: ${row.recrawlUrl}`,
			);
		});
	}
});
