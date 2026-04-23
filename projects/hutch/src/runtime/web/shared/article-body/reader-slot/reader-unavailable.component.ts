import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";

const TEMPLATE = readFileSync(
	join(__dirname, "reader-unavailable.template.html"),
	"utf-8",
);

export interface ReaderUnavailableInput {
	url: string;
}

export function renderReaderUnavailable(input: ReaderUnavailableInput): string {
	return render(TEMPLATE, { url: input.url });
}
