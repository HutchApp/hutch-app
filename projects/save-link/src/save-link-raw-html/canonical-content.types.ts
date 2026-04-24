export type CanonicalContent = {
	html: string;
	metadata: {
		title: string;
		wordCount: number;
	};
};

export type ReadCanonicalContent = (params: {
	url: string;
}) => Promise<CanonicalContent | undefined>;
