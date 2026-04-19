import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";

const TEMPLATE = readFileSync(
	join(__dirname, "summary-skipped.template.html"),
	"utf-8",
);

export function renderSummarySkipped(): string {
	return render(TEMPLATE, {});
}
