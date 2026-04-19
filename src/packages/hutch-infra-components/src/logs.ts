export const PARSE_ERROR_STREAM = "parse-errors";

export interface ParseErrorEvent {
	stream: typeof PARSE_ERROR_STREAM;
	event: "parse-failure";
	timestamp: string;
	url: string;
	reason: string;
	source: "save-link" | "hutch-view" | "hutch-queue";
}
