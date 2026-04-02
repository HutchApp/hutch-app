export type LinkId = string & { readonly __brand: "LinkId" };

function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	const port = parsed.port ? `:${parsed.port}` : "";
	return `${parsed.hostname}${port}${parsed.pathname}${parsed.search}`;
}

export const LinkId = {
	from(externalSiteUrl: string): LinkId {
		return normalizeUrl(externalSiteUrl) as LinkId;
	},
} as const;
