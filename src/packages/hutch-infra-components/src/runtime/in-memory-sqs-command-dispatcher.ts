import type { z } from "zod";
import type { HutchCommand } from "../events";
import type { DispatchCommand } from "./sqs-command-dispatcher";

interface InMemoryLogger {
	info: (message: string, context?: Record<string, unknown>) => void;
}

export function initInMemorySqsCommandDispatcher<
	C extends HutchCommand<z.ZodTypeAny>,
>(deps: {
	logger: InMemoryLogger;
	commandName: string;
	command: C;
}): { dispatch: DispatchCommand<C> } {
	const { logger, commandName, command } = deps;

	const dispatch: DispatchCommand<C> = async (detail) => {
		const validated = command.detailSchema.parse(detail);
		logger.info(`[${commandName}] dispatched (in-memory no-op)`, { detail: validated });
	};

	return { dispatch };
}
