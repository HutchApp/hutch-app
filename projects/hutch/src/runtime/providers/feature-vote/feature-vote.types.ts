import type { UserId } from "../../domain/user/user.types";
import type { FeatureId } from "./feature-vote.schema";

export type { FeatureId };

export interface FeatureVoteSummary {
	featureId: FeatureId;
	voteCount: number;
	hasVoted: boolean;
}

export type CastVote = (params: {
	featureId: FeatureId;
	userId: UserId;
}) => Promise<void>;

export type RemoveVote = (params: {
	featureId: FeatureId;
	userId: UserId;
}) => Promise<void>;

export type GetVoteSummaries = (params: {
	featureIds: FeatureId[];
	userId?: UserId;
}) => Promise<FeatureVoteSummary[]>;
