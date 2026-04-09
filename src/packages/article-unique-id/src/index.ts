function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	const port = parsed.port ? `:${parsed.port}` : "";
	return `${parsed.hostname}${port}${parsed.pathname}${parsed.search}`;
}

export class ArticleUniqueId {
	readonly value: string;
	private constructor(value: string) {
		this.value = value;
	}
	static parse(url: string): ArticleUniqueId {
		return new ArticleUniqueId(normalizeUrl(url));
	}
}
