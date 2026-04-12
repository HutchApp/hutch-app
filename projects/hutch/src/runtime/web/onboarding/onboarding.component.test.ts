import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { OnboardingChecklist } from "./onboarding.component";
import type { OnboardingContext } from "./onboarding.types";

function contextWith(overrides: Partial<OnboardingContext> = {}): OnboardingContext {
	return {
		savedArticleCount: 0,
		...overrides,
	};
}

function parse(html: string): Document {
	return new JSDOM(html).window.document;
}

describe("OnboardingChecklist", () => {
	it("renders save-first-article as incomplete and the container visible when no articles have been saved", () => {
		const doc = parse(OnboardingChecklist(contextWith({ savedArticleCount: 0 })));

		const container = doc.querySelector("[data-test-onboarding]");
		assert(container, "onboarding container must be rendered");
		assert(container.classList.contains("onboarding--visible"));
		assert(!container.classList.contains("onboarding--hidden"));

		const step = doc.querySelector('[data-test-onboarding-step="save-first-article"]');
		assert(step, "save-first-article step must be rendered");
		assert.equal(step.getAttribute("data-test-onboarding-complete"), "false");
	});

	it("renders the founder avatar alongside the intro text", () => {
		const doc = parse(OnboardingChecklist(contextWith()));

		const avatar = doc.querySelector(".onboarding__avatar");
		assert(avatar, "founder avatar must be rendered");
		assert.equal(avatar.getAttribute("alt"), "Fayner Brack");
		assert.match(avatar.getAttribute("src") ?? "", /\/fayner-brack\.jpg$/);
	});

	it("renders save-first-article as complete and the container hidden once at least one article has been saved", () => {
		const doc = parse(OnboardingChecklist(contextWith({ savedArticleCount: 1 })));

		const container = doc.querySelector("[data-test-onboarding]");
		assert(container, "onboarding container must be rendered");
		assert(container.classList.contains("onboarding--hidden"));
		assert(!container.classList.contains("onboarding--visible"));

		const step = doc.querySelector('[data-test-onboarding-step="save-first-article"]');
		assert(step, "save-first-article step must be rendered");
		assert.equal(step.getAttribute("data-test-onboarding-complete"), "true");
	});
});
