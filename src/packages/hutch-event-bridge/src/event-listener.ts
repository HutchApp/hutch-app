import assert from "node:assert";
import type { z } from "zod";
import type { SQSHandler } from "aws-lambda";

interface EventDefinition<T extends z.ZodType> {
	source: string;
	detailType: string;
	schema: T;
}

export class EventListener<T extends z.ZodType> {
	public readonly handler: SQSHandler;

	constructor(
		event: EventDefinition<T>,
		callback: (detail: z.infer<T>) => Promise<void>,
	) {
		this.handler = async (sqsEvent) => {
			for (const record of sqsEvent.Records) {
				const envelope = JSON.parse(record.body);
				assert(
					envelope["detail-type"] === event.detailType,
					`Expected detail-type "${event.detailType}" but got "${envelope["detail-type"]}"`,
				);
				const detail = event.schema.parse(envelope.detail);
				await callback(detail);
			}
		};
	}
}
