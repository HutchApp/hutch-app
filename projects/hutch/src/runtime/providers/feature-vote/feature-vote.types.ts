import type { UserId } from "../../domain/user/user.types";

export type FeatureId = string & { readonly __brand: "FeatureId" };

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
