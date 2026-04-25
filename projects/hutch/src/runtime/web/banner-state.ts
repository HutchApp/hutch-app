import type { Request } from "express";

export interface BannerState {
	isAuthenticated: boolean;
	emailVerified: boolean | undefined;
}

export function bannerStateFromRequest(req: Request): BannerState {
	return {
		isAuthenticated: Boolean(req.userId),
		emailVerified: req.emailVerified,
	};
}
