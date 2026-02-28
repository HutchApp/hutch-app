import type { NextFunction, Request, Response } from "express";

export interface Logger {
	info: (message: string) => void;
	error: (message: string, error?: Error) => void;
}

export interface LoggerMiddleware {
	(req: Request, res: Response, next: NextFunction): void;
	logger: Logger;
}

export const logger = (): LoggerMiddleware => {
	const log: Logger = {
		info: (message: string) => {
			console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
		},
		error: (message: string, error?: Error) => {
			console.error(
				`[ERROR] ${new Date().toISOString()} - ${message}`,
				error?.stack || "",
			);
		},
	};

	const middleware: LoggerMiddleware = (
		req: Request,
		_res: Response,
		next: NextFunction,
	) => {
		log.info(`${req.method} ${req.path}`);
		next();
	};

	middleware.logger = log;

	return middleware;
};
