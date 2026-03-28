import { consoleLogger } from "@packages/hutch-logger";
import { initSummaryGeneratedHandler } from "../generate-summary/summary-generated-handler";

export const handler = initSummaryGeneratedHandler({
	logger: consoleLogger,
});
