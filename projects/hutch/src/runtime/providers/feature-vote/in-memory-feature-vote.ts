import type { UserId } from "../../domain/user/user.types";
import type {
	CastVote,
	FeatureId,
	GetVoteSummaries,
	RemoveVote,
} from "./feature-vote.types";

export function initInMemoryFeatureVote(): {
	castVote: CastVote;
	removeVote: RemoveVote;
	getVoteSummaries: GetVoteSummaries;
} {
	const votes = new Map<string, Set<UserId>>();

	function voteSet(featureId: FeatureId): Set<UserId> {
		let set = votes.get(featureId);
		if (!set) {
			set = new Set<UserId>();
			votes.set(featureId, set);
		}
		return set;
	}

	const castVote: CastVote = async ({ featureId, userId }) => {
		voteSet(featureId).add(userId);
	};

	const removeVote: RemoveVote = async ({ featureId, userId }) => {
		voteSet(featureId).delete(userId);
	};

	const getVoteSummaries: GetVoteSummaries = async ({ featureIds, userId }) => {
		return featureIds.map((featureId) => {
			const set = votes.get(featureId) ?? new Set();
			return {
				featureId,
				voteCount: set.size,
				hasVoted: userId ? set.has(userId) : false,
			};
		});
	};

	return { castVote, removeVote, getVoteSummaries };
}
