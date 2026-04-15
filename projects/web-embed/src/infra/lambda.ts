import { loadOriginsFromEnv } from "../runtime/config";
import { createApp } from "../runtime/server";
import { lambdaExpress } from "./lambda-express";

const app = createApp(loadOriginsFromEnv());

export const handler = lambdaExpress({ app });
