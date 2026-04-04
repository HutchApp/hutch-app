/**
 * Prevents DynamoDB 400KB item size crashes by dropping oversized content.
 * Known limitation: SaveLinkCommandHandler reads content from DynamoDB to store in S3,
 * so articles exceeding this limit won't have S3 content either.
 * Follow-up: pipe oversized content directly to S3 from the API, bypassing DynamoDB.
 */
const CONTENT_BYTE_LIMIT = 350_000;

export function fitContent(content: string | undefined): string | undefined {
	if (!content) return undefined;
	if (Buffer.byteLength(content, "utf-8") > CONTENT_BYTE_LIMIT) return undefined;
	return content;
}
