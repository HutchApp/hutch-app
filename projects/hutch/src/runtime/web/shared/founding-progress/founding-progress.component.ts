import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "../../render";

const FOUNDING_MEMBER_LIMIT = 100;

const FOUNDING_PROGRESS_TEMPLATE = readFileSync(
	join(__dirname, "founding-progress.template.html"),
	"utf-8",
);

export function renderFoundingProgress(input: { userCount: number }): string {
	const { userCount } = input;
	const progressPercent = Math.min(
		Math.round((userCount / FOUNDING_MEMBER_LIMIT) * 100),
		100,
	);
	const allocationExhausted = userCount >= FOUNDING_MEMBER_LIMIT;
	const exhaustedStateClass = allocationExhausted
		? "founding-progress__exhausted--visible"
		: "founding-progress__exhausted--hidden";
	return render(FOUNDING_PROGRESS_TEMPLATE, {
		userCount,
		foundingMemberLimit: FOUNDING_MEMBER_LIMIT,
		progressPercent,
		exhaustedStateClass,
	});
}
