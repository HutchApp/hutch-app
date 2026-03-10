import type { NextFunction, Request, Response } from "express";
import type { HutchLogger } from "hutch-logger";

export interface LoggerMiddleware {
	(req: Request, res: Response, next: NextFunction): void;
	logger: HutchLogger;
}

export const logger = (hutchLogger: HutchLogger): LoggerMiddleware => {
	const log: HutchLogger = {
		info: (message: unknown) => {
			hutchLogger.info(
				JSON.stringify({
					level: "INFO",
					timestamp: new Date().toISOString(),
					message,
				}),
			);
		},
		error: (message: unknown, error?: unknown) => {
			const stack =
				error instanceof Error ? error.stack : undefined;
			hutchLogger.error(
				JSON.stringify({
					level: "ERROR",
					timestamp: new Date().toISOString(),
					message,
					stack,
				}),
			);
		},
		warn: (message: unknown) => {
			hutchLogger.warn(
				JSON.stringify({
					level: "WARN",
					timestamp: new Date().toISOString(),
					message,
				}),
			);
		},
		debug: (message: unknown) => {
			hutchLogger.debug(
				JSON.stringify({
					level: "DEBUG",
					timestamp: new Date().toISOString(),
					message,
				}),
			);
		},
	};

	const middleware: LoggerMiddleware = (
		req: Request,
		_res: Response,
		next: NextFunction,
	) => {
		const queryString = req.originalUrl.includes("?")
			? req.originalUrl.slice(req.originalUrl.indexOf("?"))
			: "";
		log.info(`${req.method} ${req.path}${queryString}`);
		next();
	};

	middleware.logger = log;

	return middleware;
};
