import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const esbuildLoaders: Record<string, Loader> = { ".ts": "ts" };
const bundledExtensions = Object.keys(esbuildLoaders);

function copyAssetFiles(dirs: { src: string; dest: string }) {
	for (const entry of readdirSync(dirs.src, { withFileTypes: true })) {
		const srcPath = join(dirs.src, entry.name);
		if (entry.isDirectory()) {
			copyAssetFiles({ src: srcPath, dest: dirs.dest });
		} else if (!bundledExtensions.some((ext) => entry.name.endsWith(ext))) {
			copyFileSync(srcPath, join(dirs.dest, entry.name));
		}
	}
}

export type LambdaPolicy = {
	name: string;
	policy: pulumi.Input<string>;
};

export class HutchLambda {
	public readonly name: string;
	public readonly functionName: pulumi.Output<string>;
	public readonly arn: pulumi.Output<string>;
	public readonly role: aws.iam.Role;

	constructor(
		name: string,
		args: {
			entryPoint: string;
			outputDir: string;
			assetDir: string;
			memorySize: number;
			timeout: number;
			environment: Record<string, pulumi.Input<string>>;
			policies: LambdaPolicy[];
		},
	) {
		this.name = name;
		const lambdaName = `${name}-handler`;
		const roleName = `${lambdaName}-role`;
		const basicExecutionName = `${name}-basic-execution`;

		mkdirSync(args.outputDir, { recursive: true });

		const lambdaCode = build({
			entryPoints: [args.entryPoint],
			bundle: true,
			sourcemap: true,
			platform: "node",
			format: "cjs",
			minify: true,
			outfile: `${args.outputDir}/index.js`,
			target: ["node22"],
			loader: esbuildLoaders,
		}).then(() => {
			copyAssetFiles({ src: args.assetDir, dest: args.outputDir });
			return new pulumi.asset.AssetArchive({
				".": new pulumi.asset.FileArchive(args.outputDir),
			});
		});

		this.role = new aws.iam.Role(roleName, {
			name: roleName,
			assumeRolePolicy: JSON.stringify({
				Version: "2012-10-17",
				Statement: [{
					Action: "sts:AssumeRole",
					Principal: { Service: "lambda.amazonaws.com" },
					Effect: "Allow",
				}],
			}),
		});

		new aws.iam.RolePolicyAttachment(basicExecutionName, {
			role: this.role.name,
			policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
		});

		for (const p of args.policies) {
			new aws.iam.RolePolicy(p.name, {
				name: p.name,
				role: this.role.name,
				policy: p.policy,
			});
		}

		const hasEnvironment = Object.keys(args.environment).length > 0;
		const lambdaFunction = new aws.lambda.Function(lambdaName, {
			name: lambdaName,
			runtime: aws.lambda.Runtime.NodeJS22dX,
			handler: "index.handler",
			role: this.role.arn,
			code: lambdaCode,
			memorySize: args.memorySize,
			timeout: args.timeout,
			...(hasEnvironment ? {
				environment: { variables: args.environment },
			} : {}),
		});

		this.functionName = lambdaFunction.name;
		this.arn = lambdaFunction.arn;
	}
}
