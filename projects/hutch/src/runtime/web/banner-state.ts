import type { UserId } from "../domain/user/user.types";

export interface BannerStateSource {
	userId?: UserId;
	emailVerified?: boolean;
}

export interface BannerState {
	isAuthenticated: boolean;
	emailVerified: boolean | undefined;
}

export function bannerStateFromRequest(req: BannerStateSource): BannerState {
	return {
		isAuthenticated: Boolean(req.userId),
		emailVerified: req.emailVerified,
	};
}
