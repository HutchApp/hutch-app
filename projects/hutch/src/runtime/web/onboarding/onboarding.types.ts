export interface OnboardingContext {
	savedArticleCount: number;
}

export interface OnboardingStep {
	id: string;
	title: string;
	description: string;
	isComplete: (ctx: OnboardingContext) => boolean;
}
