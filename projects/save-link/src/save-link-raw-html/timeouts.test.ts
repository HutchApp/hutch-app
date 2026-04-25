import { SELECT_CONTENT_TIMEOUTS } from "./timeouts";

describe("SELECT_CONTENT_TIMEOUTS", () => {
	it("deepseek client aborts before the Lambda timeout", () => {
		const lambdaMs = SELECT_CONTENT_TIMEOUTS.lambdaSeconds * 1000;
		expect(SELECT_CONTENT_TIMEOUTS.deepseekMs).toBeLessThan(lambdaMs);
	});
});
