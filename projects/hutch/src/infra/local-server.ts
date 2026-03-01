import type { Express } from "express";
import type { Logger } from "./logger";
import { getEnv } from "../runtime/require-env";

export const localServer = (app: Express, logger: Logger): void => {
	const port = getEnv("PORT") || "3000";
	app.listen(Number.parseInt(port, 10), () => {
		logger.info(`Local server running on http://localhost:${port}`);
	});
};
