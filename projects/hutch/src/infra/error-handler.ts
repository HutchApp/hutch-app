import type { NextFunction, Request, Response } from "express";

export const errorHandler = () => {
	return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
		console.error("[ERROR]", err.stack);
		res.status(500).json({ error: "Internal Server Error" });
	};
};
