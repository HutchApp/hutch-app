import { randomBytes } from "node:crypto";
import { type VisitorId, VisitorIdSchema } from "./ab.types";

export type GenerateVisitorId = () => VisitorId;

export const defaultGenerateVisitorId: GenerateVisitorId = () =>
	VisitorIdSchema.parse(randomBytes(16).toString("hex"));

export function parseVisitorId(value: unknown): VisitorId | undefined {
	const result = VisitorIdSchema.safeParse(value);
	return result.success ? result.data : undefined;
}
