const CONTENT_BYTE_LIMIT = 350_000;

export function fitContent(content: string | undefined): string | undefined {
	if (!content) return undefined;
	if (Buffer.byteLength(content, "utf-8") > CONTENT_BYTE_LIMIT) return undefined;
	return content;
}
