import type { HutchLogger } from "@packages/hutch-logger";
import {
	PARSE_ERROR_STREAM,
	type ParseErrorEvent,
} from "@packages/hutch-infra-components";

export type LogParseError = (params: { url: string; reason: string }) => void;

export function initLogParseError(deps: {
	logger: HutchLogger.Typed<ParseErrorEvent>;
	now: () => Date;
}): { logParseError: LogParseError } {
	const logParseError: LogParseError = (params) => {
		deps.logger.info({
			stream: PARSE_ERROR_STREAM,
			event: "parse-failure",
			timestamp: deps.now().toISOString(),
			url: params.url,
			reason: params.reason,
			source: "save-link",
		});
	};
	return { logParseError };
}
