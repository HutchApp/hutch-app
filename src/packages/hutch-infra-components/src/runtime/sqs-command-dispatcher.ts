/* c8 ignore start -- thin SDK wrapper, only used in prod path */
import type { z } from "zod";
import type { SQSClient } from "@aws-sdk/client-sqs";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import type { HutchCommand } from "../events";

export type DispatchCommand<C extends HutchCommand<z.ZodTypeAny>> = (
	detail: z.infer<C["detailSchema"]>,
) => Promise<void>;

export function initSqsCommandDispatcher<C extends HutchCommand<z.ZodTypeAny>>(deps: {
	sqsClient: Pick<SQSClient, "send">;
	queueUrl: string;
	command: C;
}): { dispatch: DispatchCommand<C> } {
	const { sqsClient, queueUrl, command } = deps;

	const dispatch: DispatchCommand<C> = async (detail) => {
		const validated = command.detailSchema.parse(detail);
		await sqsClient.send(
			new SendMessageCommand({
				QueueUrl: queueUrl,
				MessageBody: JSON.stringify({ detail: validated }),
			}),
		);
	};

	return { dispatch };
}
/* c8 ignore stop */
