import type { Handler } from "aws-lambda";
import type { Express } from "express";
import serverless from "serverless-http";

export const lambdaExpress = ({ app }: { app: Express }): Handler => serverless(app);
