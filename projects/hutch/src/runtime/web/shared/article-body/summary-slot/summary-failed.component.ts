import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../../render";

const TEMPLATE = readFileSync(
	join(__dirname, "summary-failed.template.html"),
	"utf-8",
);

export function renderSummaryFailed(): string {
	return render(TEMPLATE, {});
}
