import type { Logger } from "./logger";

export const awsLambdaLogger = (
	logger: Logger,
): ((message: string) => void) => {
	return (message: string) => {
		logger.info(`[Lambda] ${message}`);
	};
};
