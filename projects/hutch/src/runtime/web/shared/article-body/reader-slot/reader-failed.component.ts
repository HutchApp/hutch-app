import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";

const TEMPLATE = readFileSync(
	join(__dirname, "reader-failed.template.html"),
	"utf-8",
);

export interface ReaderFailedInput {
	url: string;
}

export function renderReaderFailed(input: ReaderFailedInput): string {
	return render(TEMPLATE, { url: input.url });
}
