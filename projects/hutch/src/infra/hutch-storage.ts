import * as aws from "@pulumi/aws";

export class HutchStorage {
	public readonly articlesTable: aws.dynamodb.Table;
	public readonly userArticlesTable: aws.dynamodb.Table;
	public readonly usersTable: aws.dynamodb.Table;
	public readonly sessionsTable: aws.dynamodb.Table;
	public readonly oauthTable: aws.dynamodb.Table;
	public readonly verificationTokensTable: aws.dynamodb.Table;

	constructor(_name: string, args: { deletionProtection: boolean; tableNames: {
		articles: string;
		userArticles: string;
		users: string;
		sessions: string;
		oauth: string;
		verificationTokens: string;
	} }) {
		this.articlesTable = new aws.dynamodb.Table(`hutch-articles`, {
			name: args.tableNames.articles,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
			hashKey: "url",
			attributes: [
				{ name: "url", type: "S" },
				{ name: "routeId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "routeId-index",
					hashKey: "routeId",
					projectionType: "ALL",
				},
			],
		});

		this.userArticlesTable = new aws.dynamodb.Table(`hutch-user-articles`, {
			name: args.tableNames.userArticles,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
			hashKey: "userId",
			rangeKey: "url",
			attributes: [
				{ name: "userId", type: "S" },
				{ name: "url", type: "S" },
				{ name: "savedAt", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-savedAt-index",
					hashKey: "userId",
					rangeKey: "savedAt",
					projectionType: "ALL",
				},
			],
		});

		this.usersTable = new aws.dynamodb.Table(`hutch-users`, {
			name: args.tableNames.users,
			billingMode: "PAY_PER_REQUEST",
			deletionProtectionEnabled: args.deletionProtection,
			hashKey: "email",
			attributes: [
				{ name: "email", type: "S" },
				{ name: "userId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-index",
					hashKey: "userId",
					projectionType: "ALL",
				},
			],
		});

		this.sessionsTable = new aws.dynamodb.Table(`hutch-sessions`, {
			name: args.tableNames.sessions,
			billingMode: "PAY_PER_REQUEST",
			hashKey: "sessionId",
			attributes: [{ name: "sessionId", type: "S" }],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});

		this.oauthTable = new aws.dynamodb.Table(`hutch-oauth`, {
			name: args.tableNames.oauth,
			billingMode: "PAY_PER_REQUEST",
			hashKey: "pk",
			attributes: [
				{ name: "pk", type: "S" },
				{ name: "userId", type: "S" },
			],
			globalSecondaryIndexes: [
				{
					name: "userId-index",
					hashKey: "userId",
					projectionType: "ALL",
				},
			],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});

		this.verificationTokensTable = new aws.dynamodb.Table(`hutch-verification-tokens`, {
			name: args.tableNames.verificationTokens,
			billingMode: "PAY_PER_REQUEST",
			hashKey: "token",
			attributes: [{ name: "token", type: "S" }],
			ttl: {
				attributeName: "expiresAt",
				enabled: true,
			},
		});
	}
}
