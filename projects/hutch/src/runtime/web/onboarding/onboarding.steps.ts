import type { OnboardingStep } from "./onboarding.types";

const BROWSER_LABELS: Record<string, string> = {
	firefox: "Firefox",
	chrome: "Chrome",
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
	{
		id: "install-extension",
		title: (ctx) => {
			const label = BROWSER_LABELS[ctx.browser];
			return label
				? `Install the ${label} browser extension`
				: "Install a browser extension";
		},
		description:
			"Add Hutch to your browser so you can save any page with one click.",
		isComplete: (ctx) => ctx.extensionInstalled,
		actions: (ctx) => {
			const INSTALL_URLS: Record<string, string> = {
				firefox: "/install?browser=firefox",
				chrome: "/install?browser=chrome",
			};
			return [{
				label: BROWSER_LABELS[ctx.browser] ? "Install" : "Choose browser",
				url: INSTALL_URLS[ctx.browser] ?? "/install",
			}];
		},
	},
	{
		id: "save-first-article",
		title: () => "Save your first article",
		description:
			"Paste a URL to save, or press your browser extension button on any page you want to read later to save the current tab to your reading list.",
		isComplete: (ctx) => ctx.savedArticleCount > 0,
	},
];
