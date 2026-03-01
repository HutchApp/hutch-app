import type { APIGatewayProxyEventV2, Context, Handler } from "aws-lambda";
import { getEnv } from "../runtime/require-env";

export const removeStageFromRawPath = (
	handler: Handler<APIGatewayProxyEventV2>,
): Handler<APIGatewayProxyEventV2> => {
	return async (event: APIGatewayProxyEventV2, context: Context) => {
		const stage = getEnv("STAGE") || "dev";
		const stagePrefix = `/${stage}`;

		if (event.rawPath?.startsWith(stagePrefix)) {
			event.rawPath = event.rawPath.slice(stagePrefix.length) || "/";
		}

		if (event.requestContext?.http?.path?.startsWith(stagePrefix)) {
			event.requestContext.http.path =
				event.requestContext.http.path.slice(stagePrefix.length) || "/";
		}

		return handler(event, context, () => {});
	};
};
