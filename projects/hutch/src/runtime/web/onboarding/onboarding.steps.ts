import type { OnboardingStep } from "./onboarding.types";

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
	{
		id: "save-first-article",
		title: "Save your first article",
		description:
			"Paste a URL to save, or press your browser extension button on any page you want to read later to save the current tab to your reading list.",
		isComplete: (ctx) => ctx.savedArticleCount > 0,
	},
];
