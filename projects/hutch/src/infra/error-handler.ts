import type { NextFunction, Request, Response } from "express";

export interface ErrorResponse {
	error: string;
	message?: string;
	statusCode: number;
}

export const errorHandler = () => {
	return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
		console.error(
			JSON.stringify({
				level: "ERROR",
				timestamp: new Date().toISOString(),
				message: "Unhandled error",
				stack: err.stack,
			}),
		);
		const response: ErrorResponse = {
			error: "Internal Server Error",
			statusCode: 500,
		};
		res.status(response.statusCode).json(response);
	};
};
