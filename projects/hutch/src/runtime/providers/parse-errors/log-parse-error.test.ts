import type { HutchLogger } from "@packages/hutch-logger";
import {
	PARSE_ERROR_STREAM,
	type ParseErrorEvent,
} from "@packages/hutch-infra-components";
import { initLogParseError } from "./log-parse-error";

function createCapturingLogger(): {
	logger: HutchLogger.Typed<ParseErrorEvent>;
	captured: ParseErrorEvent[];
} {
	const captured: ParseErrorEvent[] = [];
	const logger: HutchLogger.Typed<ParseErrorEvent> = {
		info: (data) => { captured.push(data); },
		error: () => {},
		warn: () => {},
		debug: () => {},
	};
	return { logger, captured };
}

describe("initLogParseError (hutch)", () => {
	it("emits a structured parse-failure event with the caller-provided source", () => {
		const { logger, captured } = createCapturingLogger();
		const { logParseError } = initLogParseError({
			logger,
			now: () => new Date("2026-04-19T10:30:00.000Z"),
		});

		logParseError({
			url: "https://example.com/blocked",
			reason: "Could not fetch article",
			source: "hutch-view",
		});

		expect(captured).toEqual([{
			stream: PARSE_ERROR_STREAM,
			event: "parse-failure",
			timestamp: "2026-04-19T10:30:00.000Z",
			url: "https://example.com/blocked",
			reason: "Could not fetch article",
			source: "hutch-view",
		}]);
	});
});
