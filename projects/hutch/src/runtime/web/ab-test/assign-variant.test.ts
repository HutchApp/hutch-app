import { VisitorIdSchema } from "./ab.types";
import { assignHomepageVariant } from "./assign-variant";

function visitorId(value: string) {
	return VisitorIdSchema.parse(value);
}

describe("assignHomepageVariant", () => {
	it("returns the same variant for the same visitor id — assignment is sticky across sessions", () => {
		const id = visitorId("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
		expect(assignHomepageVariant(id)).toBe(assignHomepageVariant(id));
	});

	it("splits roughly evenly across 1000 random visitor ids — verifies the bucketing is balanced enough for a useful experiment", () => {
		let control = 0;
		let treatment = 0;
		for (let i = 0; i < 1000; i++) {
			const hex = i.toString(16).padStart(32, "0");
			const variant = assignHomepageVariant(visitorId(hex));
			if (variant === "control") control++;
			else treatment++;
		}
		expect(control).toBeGreaterThan(400);
		expect(treatment).toBeGreaterThan(400);
		expect(control + treatment).toBe(1000);
	});

	it("returns one of the declared variants for any input", () => {
		const id = visitorId("0123456789abcdef0123456789abcdef");
		const variant = assignHomepageVariant(id);
		expect(["control", "treatment-founding-cta"]).toContain(variant);
	});
});
