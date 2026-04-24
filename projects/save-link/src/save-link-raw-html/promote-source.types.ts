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
	tier: string;
	metadata: PromoteSourceMetadata;
}) => Promise<void>;
