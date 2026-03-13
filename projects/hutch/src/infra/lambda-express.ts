import type { Handler } from "aws-lambda";
import type { Express, Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import serverless from "serverless-http";
import { HutchLogger, consoleLogger } from "hutch-logger";
import { logger as requestLogger } from "./logger";
import { errorHandler } from "./error-handler";
import { removeStageFromRawPath } from "./remove-stage-from-raw-path";
import { localServer } from "../runtime/app";
import { getEnv } from "../runtime/require-env";

// present in Lambda runtime, absent locally — https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
const lambda = !!getEnv("AWS_LAMBDA_FUNCTION_NAME");

export const lambdaExpress = ({
	app,
	binaryMimeTypes,
}: { app: Express; binaryMimeTypes?: string[] }): Handler => {
	const log = requestLogger();
	const logger = HutchLogger.from(consoleLogger);

	const application = express()
		.disable("x-powered-by")
		.use(helmet({ contentSecurityPolicy: false }))
		.use(
			compression({
				filter: (req: Request, res: Response) =>
					lambda ? compression.filter(req, res) : false,
			}),
		)
		.use(log)
		.use(app)
		.use(errorHandler(logger));

	// ---

	if (lambda) {
		return removeStageFromRawPath(
			serverless(application, {
				...(binaryMimeTypes ? { binary: binaryMimeTypes } : {}),
			}),
		);
	}

	localServer(application, log.logger);
	return () => {}; // local noop handler
};
