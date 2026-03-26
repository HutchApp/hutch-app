import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	PutCommand,
	DeleteCommand,
	QueryCommand,
	BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
	FeatureId,
	GetVoteSummaries,
	ToggleVote,
} from "./feature-vote.types";
import type { UserId } from "../../domain/user/user.types";

export function initDynamoDbFeatureVote(deps: {
	client: DynamoDBDocumentClient;
	tableName: string;
}): {
	toggleVote: ToggleVote;
	getVoteSummaries: GetVoteSummaries;
} {
	const { client, tableName } = deps;

	async function removeVote({ featureId, userId }: { featureId: FeatureId; userId: UserId }) {
		await client.send(
			new DeleteCommand({
				TableName: tableName,
				Key: { featureId, userId },
			}),
		);
	}

	const toggleVote: ToggleVote = async ({ featureId, userId }) => {
		try {
			await client.send(
				new PutCommand({
					TableName: tableName,
					Item: { featureId, userId },
					ConditionExpression: "attribute_not_exists(featureId)",
				}),
			);
		} catch (error: unknown) {
			if (
				error instanceof Error &&
				error.name === "ConditionalCheckFailedException"
			) {
				await removeVote({ featureId, userId });
				return;
			}
			throw error;
		}
	};

	const getVoteSummaries: GetVoteSummaries = async ({ featureIds, userId }) => {
		const countResults = await Promise.all(
			featureIds.map((featureId) =>
				client.send(
					new QueryCommand({
						TableName: tableName,
						KeyConditionExpression: "featureId = :fid",
						ExpressionAttributeValues: { ":fid": featureId },
						Select: "COUNT",
					}),
				),
			),
		);

		let votedFeatureIds = new Set<string>();
		if (userId) {
			const keys = featureIds.map((featureId) => ({ featureId, userId }));
			const batchResult = await client.send(
				new BatchGetCommand({
					RequestItems: {
						[tableName]: { Keys: keys },
					},
				}),
			);
			const items = batchResult.Responses?.[tableName] ?? [];
			votedFeatureIds = new Set(items.map((item) => String(item.featureId)));
		}

		return featureIds.map((featureId, index) => ({
			featureId,
			voteCount: countResults[index].Count ?? 0,
			hasVoted: votedFeatureIds.has(featureId),
		}));
	};

	return { toggleVote, getVoteSummaries };
}
