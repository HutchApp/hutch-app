import type { UserId } from "../../domain/user/user.types";
import type {
	FeatureId,
	GetVoteSummaries,
	ToggleVote,
} from "./feature-vote.types";

export function initInMemoryFeatureVote(): {
	toggleVote: ToggleVote;
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

	const toggleVote: ToggleVote = async ({ featureId, userId }) => {
		const set = voteSet(featureId);
		if (set.has(userId)) {
			set.delete(userId);
		} else {
			set.add(userId);
		}
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

	return { toggleVote, getVoteSummaries };
}
