import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { build, type Loader, type Plugin } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const esbuildLoaders: Record<string, Loader> = { ".ts": "ts" };
const bundledExtensions = Object.keys(esbuildLoaders);

function copyAssetFiles(dirs: { src: string; dest: string }) {
	for (const entry of readdirSync(dirs.src, { withFileTypes: true })) {
		const srcPath = join(dirs.src, entry.name);
		if (entry.isDirectory()) {
			const destSubdir = join(dirs.dest, entry.name);
			mkdirSync(destSubdir, { recursive: true });
			copyAssetFiles({ src: srcPath, dest: destSubdir });
		} else if (!bundledExtensions.some((ext) => entry.name.endsWith(ext))) {
			copyFileSync(srcPath, join(dirs.dest, entry.name));
		}
	}
}

/**
 * esbuild bundles all code into a single index.js, so __dirname resolves to the
 * bundle root for every source module. This plugin rewrites __dirname in files
 * within the asset directory to include the file's relative path from the asset
 * root, so readFileSync(join(__dirname, "file")) resolves to the correct
 * subdirectory where copyAssetFiles placed the asset.
 */
function createDirnamePlugin(assetDir: string): Plugin {
	const assetDirAbs = resolve(assetDir);
	return {
		name: "dirname-rewrite",
		setup(pluginBuild) {
			pluginBuild.onLoad({ filter: /\.ts$/ }, (args) => {
				if (!args.path.startsWith(assetDirAbs)) return;

				const relPath = relative(assetDirAbs, dirname(args.path));
				const contents = readFileSync(args.path, "utf-8");
				return {
					contents: contents.replace(
						/__dirname/g,
						`require("node:path").join(__dirname, ${JSON.stringify(relPath)})`,
					),
					loader: "ts" as const,
				};
			});
		},
	};
}

export type LambdaPolicy = {
	name: string;
	policy: pulumi.Input<string>;
};

export class HutchLambda extends pulumi.ComponentResource {
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
		opts?: pulumi.ComponentResourceOptions,
	) {
		super("hutch:infra:HutchLambda", name, {}, opts);

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
			plugins: [createDirnamePlugin(args.assetDir)],
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
		}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });

		new aws.iam.RolePolicyAttachment(basicExecutionName, {
			role: this.role.name,
			policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
		}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });

		for (const p of args.policies) {
			new aws.iam.RolePolicy(p.name, {
				name: p.name,
				role: this.role.name,
				policy: p.policy,
			}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });
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
		}, { parent: this, aliases: [{ parent: pulumi.rootStackResource }] });

		this.functionName = lambdaFunction.name;
		this.arn = lambdaFunction.arn;
		this.registerOutputs();
	}
}
