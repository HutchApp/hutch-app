import { z } from "zod";

const AwsSdkErrorShape = z.object({
	name: z.string().optional(),
	message: z.string().optional(),
	Code: z.string().optional(),
	$fault: z.enum(["client", "server"]).optional(),
	$metadata: z.object({
		httpStatusCode: z.number().optional(),
		requestId: z.string().optional(),
		extendedRequestId: z.string().optional(),
		cfId: z.string().optional(),
	}).optional(),
}).loose();

/**
 * The AWS SDK degrades the error name/message to "Unknown" when it can't
 * parse the response body (typical 403 with no XML), but still fills in
 * `$metadata.requestId` / `$metadata.extendedRequestId` / `$metadata.cfId`.
 * Without those, an "UnknownError" 403 is unsearchable in CloudWatch and
 * untraceable through AWS support — so flatten them into the parse-error
 * reason instead of relying on the raw runtime log.
 */
export function describeAwsError(err: unknown): string {
	if (!(err instanceof Error)) return `non-error: ${String(err)}`;
	const parsed = AwsSdkErrorShape.safeParse(err);
	const e = parsed.success ? parsed.data : {};
	const m = e.$metadata ?? {};
	const parts: string[] = [
		`name=${e.name ?? err.name}`,
		...(e.Code ? [`code=${e.Code}`] : []),
		...(m.httpStatusCode !== undefined ? [`status=${m.httpStatusCode}`] : []),
		...(e.$fault ? [`fault=${e.$fault}`] : []),
		...(m.requestId ? [`requestId=${m.requestId}`] : []),
		...(m.extendedRequestId ? [`extendedRequestId=${m.extendedRequestId}`] : []),
		...(m.cfId ? [`cfId=${m.cfId}`] : []),
		`message=${e.message ?? err.message}`,
	];
	return parts.join(" ");
}
