import { app } from "../runtime/app";
import { lambdaExpress } from "./lambda-express";

export const handler = lambdaExpress({ app });
