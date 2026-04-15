import * as pulumi from "@pulumi/pulumi";
import assert from "node:assert";
import {
	HutchLambda,
	HutchAPIGatewayLambdaRoute,
} from "@packages/hutch-infra-components/infra";

const config = new pulumi.Config();
const hutchStackName = config.require("hutchStack");

const hutchStack = new pulumi.StackReference(hutchStackName);

/**
 * Fail fast with a clear message if hutch hasn't been deployed yet. Without this,
 * a missing output surfaces later as a cryptic undefined-property error during
 * Pulumi resource creation.
 */
function requireHutchStackOutput(name: string): pulumi.Output<string> {
	return hutchStack.getOutput(name).apply((value) => {
		assert(
			value,
			`hutch stack "${hutchStackName}" does not export "${name}". ` +
				`Deploy hutch first: pnpm nx run hutch:deploy-infra`,
		);
		return String(value);
	});
}

const apiGatewayId = requireHutchStackOutput("apiGatewayId");
const apiGatewayExecutionArn = requireHutchStackOutput("apiGatewayExecutionArn");
const appOrigin = requireHutchStackOutput("appOrigin");
const embedOrigin = appOrigin.apply((url) => `${url}/embed`);

const lambda = new HutchLambda("web-embed", {
	entryPoint: "./src/infra/lambda.ts",
	outputDir: ".lib/web-embed-api",
	assetDir: "./src/runtime",
	memorySize: 256,
	timeout: 10,
	environment: {
		NODE_ENV: "production",
		APP_ORIGIN: appOrigin,
		EMBED_ORIGIN: embedOrigin,
	},
	policies: [],
});

const route = new HutchAPIGatewayLambdaRoute("web-embed", {
	apiGatewayId,
	apiGatewayExecutionArn,
	lambda,
	routeKeys: ["ANY /embed", "ANY /embed/{proxy+}"],
});

export const functionName = lambda.functionName;
export const embedUrl = embedOrigin;
export const _dependencies: pulumi.Resource[] = route.routes;
