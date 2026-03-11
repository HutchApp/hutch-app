import { createHutchApp } from "../runtime/app";
import { lambdaExpress } from "./lambda-express";

const { app } = createHutchApp();

export const handler = lambdaExpress({ app });
