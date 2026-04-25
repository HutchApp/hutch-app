import type { TierName } from "@packages/hutch-infra-components";

export type PromoteSourceMetadata = {
	title: string;
	siteName: string;
	excerpt: string;
	wordCount: number;
	estimatedReadTime: number;
	imageUrl?: string;
};

export type PromoteSourceToCanonical = (params: {
	url: string;
	tier: TierName;
	metadata: PromoteSourceMetadata;
}) => Promise<void>;
