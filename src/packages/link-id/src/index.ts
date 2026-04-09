export type NormalisedUrl = string & { readonly __brand: "NormalisedUrl" };

function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	const port = parsed.port ? `:${parsed.port}` : "";
	return `${parsed.hostname}${port}${parsed.pathname}${parsed.search}`;
}

export const LinkId = {
	from(externalSiteUrl: string): NormalisedUrl {
		return normalizeUrl(externalSiteUrl) as NormalisedUrl;
	},
} as const;
