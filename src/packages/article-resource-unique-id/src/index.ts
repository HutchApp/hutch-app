function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	const port = parsed.port ? `:${parsed.port}` : "";
	return `${parsed.hostname}${port}${parsed.pathname}${parsed.search}`;
}

export class ArticleResourceUniqueId {
	readonly value: string;
	private constructor(value: string) {
		this.value = value;
	}
	static parse(url: string): ArticleResourceUniqueId {
		return new ArticleResourceUniqueId(normalizeUrl(url));
	}
	toEncodedURLPathComponent(): string {
		return encodeURIComponent(this.value);
	}
	toJSON(): string {
		return this.value;
	}
	toString(): string {
		return this.value;
	}
}
