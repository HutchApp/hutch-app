import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	DeleteCommand,
	QueryCommand,
	BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
	CastVote,
	FeatureVoteSummary,
	GetVoteSummaries,
	RemoveVote,
} from "./feature-vote.types";

export function initDynamoDbFeatureVote(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	castVote: CastVote;
	removeVote: RemoveVote;
	getVoteSummaries: GetVoteSummaries;
} {
	const { client, tableName } = deps;

	const castVote: CastVote = async ({ featureId, userId }) => {
		await client.send(
			new PutCommand({
				TableName: tableName,
				Item: { featureId, userId },
			}),
		);
	};

	const removeVote: RemoveVote = async ({ featureId, userId }) => {
		await client.send(
			new DeleteCommand({
				TableName: tableName,
				Key: { featureId, userId },
			}),
		);
	};

	const getVoteSummaries: GetVoteSummaries = async ({ featureIds, userId }) => {
		const summaries: FeatureVoteSummary[] = [];

		for (const featureId of featureIds) {
			const result = await client.send(
				new QueryCommand({
					TableName: tableName,
					KeyConditionExpression: "featureId = :fid",
					ExpressionAttributeValues: { ":fid": featureId },
					Select: "COUNT",
				}),
			);

			const voteCount = result.Count ?? 0;
			let hasVoted = false;

			if (userId) {
				const keys = [{ featureId, userId }];
				const batchResult = await client.send(
					new BatchGetCommand({
						RequestItems: {
							[tableName]: { Keys: keys },
						},
					}),
				);
				const items = batchResult.Responses?.[tableName] ?? [];
				hasVoted = items.length > 0;
			}

			summaries.push({ featureId, voteCount, hasVoted });
		}

		return summaries;
	};

	return { castVote, removeVote, getVoteSummaries };
}
