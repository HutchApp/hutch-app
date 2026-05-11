/**
 * Pure pieces of the stuck-articles canary, extracted so the unit tests can
 * exercise them without registering the top-level `test("Stuck articles
 * canary", …)` block (which would fire `requireEnv` at module load and abort
 * the test process). `check-stuck-articles.ts` is the entry point that wires
 * production deps; this file is what the canary does once those deps exist.
 */
import assert from "node:assert/strict";
import {
	CrawlStatusSchema,
	SummaryStatusSchema,
} from "@packages/article-state-types";
import {
	type DynamoDBDocumentClient,
	defineDynamoTable,
	dynamoField,
} from "@packages/hutch-storage-client";
import { z } from "zod";
import { checkTerminalState } from "./check-terminal-state";
import { type StuckReason, classifyRow } from "./classify-row";
import { EXCLUDE_PATTERNS } from "./exclude-patterns";

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
	firstSeenAt: dynamoField(z.string()),
	summary: dynamoField(z.string()),
});

function isExcluded(url: string): boolean {
	return EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

export interface StuckRow {
	originalUrl: string;
	reasons: StuckReason[];
	contentFetchedAt: string | undefined;
	failureReason: string | undefined;
	recrawlUrl: string;
	/**
	 * Human-readable explanation of which sub-state(s) are non-terminal,
	 * computed via checkTerminalState. Surfaced in the failing test message
	 * so an operator reading the GitHub Actions output knows at a glance
	 * which writer to suspect without cross-referencing the reason enum.
	 */
	terminalCheckMessage: string;
}

/**
 * Hard cap on DDB scan pages. The articles table is small enough that a real
 * scan completes in well under 10 pages. Crossing 50 means the FilterExpression
 * stopped narrowing the scan (or the table grew an order of magnitude) — fail
 * loud here instead of burning the runner's 10-minute budget.
 */
const MAX_PAGES = 50;

/**
 * Minimum age before a `crawlStatus='pending'` row counts as stuck.
 *
 * 1. Anchored to retry-chain wall-clock = visibility × maxReceiveCount per
 *    crawl-pipeline-rca §4. The longest pending-crawl chain is the
 *    `save-link-command` queue (visibility 360s × default maxReceiveCount 3 =
 *    1080s = 18 min); after that exhausts, `HutchDLQEventHandler` flips
 *    `crawlStatus` to `failed`. Allow 2 min margin for AWS dispatch variance
 *    and writer/canary clock skew → 20 min.
 *
 * 2. Tune via Phase 2 measurement loop in plan-5 once a week of clean signal
 *    is available — do NOT lower below 18 min without re-checking the queue
 *    budgets in `projects/save-link/src/infra/index.ts`.
 */
export const CRAWL_MIN_AGE_MS = 20 * 60_000; /* 1, 2 */

/**
 * Minimum age before a `summaryStatus='pending'` row counts as stuck.
 *
 * 1. Generate-summary retry chain is visibility 300s × default maxReceiveCount
 *    3 = 900s = 15 min. Bumped to 20 min to absorb DeepSeek slow periods
 *    documented in #251 — DeepSeek occasionally drags an in-flight summary
 *    past the SQS budget without the chain failing.
 *
 * 2. Tune via Phase 2 measurement loop in plan-5; if Phase 2 shows summary
 *    transitions consistently inside 15 min, drop to match the crawl threshold.
 */
export const SUMMARY_MIN_AGE_MS = 20 * 60_000; /* 1, 2 */

/**
 * Build the ScanCommandInput body used by `collectStuckRows`. Exported as a
 * pure function so the unit tests can assert on the FilterExpression and
 * ExpressionAttributeValues without spinning up a fake client. The `now`
 * parameter is the canary's wall-clock reference point — subtracting
 * CRAWL_MIN_AGE_MS / SUMMARY_MIN_AGE_MS produces the ISO-string thresholds
 * DDB compares against the row's `firstSeenAt` / `contentFetchedAt` attrs.
 *
 * Age-gate disjunction explained, per axis:
 *   1. `contentFetchedAt < :axisMinAge` — covers a previously-crawled row that
 *      was recrawled; if the recrawl is in flight, the existing
 *      `contentFetchedAt` is still the old value and counts as old enough.
 *   2. `attribute_not_exists(contentFetchedAt) AND firstSeenAt < :axisMinAge`
 *      — first-time pending row that has never crawled successfully.
 *   3. `attribute_not_exists(contentFetchedAt) AND attribute_not_exists(firstSeenAt)`
 *      — pre-firstSeenAt rows (no timestamps at all). Without this disjunct
 *      they would be silently filtered out by the age gate, and a legacy row
 *      stuck pending forever would never surface.
 *
 * The "legacy-stub" disjunct (no statuses, no summary) and the
 * "summary-ready-without-text" writer-contract violation disjunct are NOT
 * age-gated: neither is a timing artefact, so flagging them at any age is
 * correct.
 */
export function buildScanInput(now: Date) {
	const crawlMinAge = new Date(now.getTime() - CRAWL_MIN_AGE_MS).toISOString();
	const summaryMinAge = new Date(now.getTime() - SUMMARY_MIN_AGE_MS).toISOString();
	const ageGate = (axisMinAgeKey: string) =>
		`(contentFetchedAt < ${axisMinAgeKey}` +
		` OR (attribute_not_exists(contentFetchedAt) AND firstSeenAt < ${axisMinAgeKey})` +
		` OR (attribute_not_exists(contentFetchedAt) AND attribute_not_exists(firstSeenAt)))`;
	return {
		// The third disjunct catches the `summaryStatus="ready" AND
		// attribute_not_exists(summary)` inconsistency the 2026-05-10
		// freshness-refresh regression introduced — without it the row
		// passes both status checks and the canary reports green while the
		// reader UI polls "Generating summary…" forever.
		//
		// Terminal failures (crawlStatus / summaryStatus = `failed` or
		// `unsupported`) are excluded from the scan: the operator owns
		// recovery via /admin/recrawl and the DLQ → SNS email alarm is the
		// redrive signal, so flagging them here would drown actionable
		// pending-row reports in noise.
		FilterExpression:
			`(summaryStatus = :pending AND ${ageGate(":summaryMinAge")}) ` +
			`OR (crawlStatus = :pending AND ${ageGate(":crawlMinAge")}) ` +
			"OR (attribute_not_exists(summaryStatus) AND attribute_not_exists(crawlStatus) AND attribute_not_exists(summary)) " +
			"OR (summaryStatus = :ready AND attribute_not_exists(summary))",
		ProjectionExpression:
			"originalUrl, #u, summaryStatus, crawlStatus, summaryFailureReason, crawlFailureReason, contentFetchedAt, firstSeenAt, summary",
		ExpressionAttributeNames: { "#u": "url" },
		ExpressionAttributeValues: {
			":pending": "pending",
			":ready": "ready",
			":crawlMinAge": crawlMinAge,
			":summaryMinAge": summaryMinAge,
		},
	} as const;
}

export async function collectStuckRows(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
	origin: string;
	now: () => Date;
}): Promise<StuckRow[]> {
	const table = defineDynamoTable({
		client: deps.client,
		tableName: deps.tableName,
		schema: StuckArticleRow,
	});
	const stuck: StuckRow[] = [];
	let skippedNoOriginal = 0;
	let excludedDomain = 0;
	let pageCount = 0;
	let lastEvaluatedKey: Record<string, unknown> | undefined;
	const scanInput = buildScanInput(deps.now());
	do {
		pageCount += 1;
		assert(
			pageCount <= MAX_PAGES,
			`pagination cap reached (${MAX_PAGES} pages) — refine FilterExpression or raise the cap if the table is legitimately growing`,
		);
		const page = await table.scan({
			...scanInput,
			ExclusiveStartKey: lastEvaluatedKey,
		});
		for (const row of page.items) {
			const verdict = checkTerminalState(row);
			if (verdict.terminal) continue;
			const reasons = classifyRow(row);
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
				recrawlUrl: `${deps.origin}/admin/recrawl/${encodeURIComponent(row.originalUrl)}`,
				terminalCheckMessage: verdict.message,
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
