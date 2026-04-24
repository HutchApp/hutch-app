import type { NextFunction, Request, Response } from "express";
import type { FindUserByEmail } from "../../../providers/auth/auth.types";

export interface RequireAdminDeps {
	findUserByEmail: FindUserByEmail;
	adminEmails: readonly string[];
}

/**
 * Gate for operator-only routes. Requires:
 *   1. a populated session cookie (req.userId), else 303 → /login
 *   2. the session's user to match one of the allowlisted emails, else 403
 *
 * Matching is by userId comparison (findUserByEmail → userId), so existing
 * sessions need no schema change.
 */
export function initRequireAdmin(deps: RequireAdminDeps) {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		if (!req.userId) {
			res.redirect(303, "/login");
			return;
		}
		for (const email of deps.adminEmails) {
			const user = await deps.findUserByEmail(email);
			if (user && user.userId === req.userId) {
				next();
				return;
			}
		}
		res
			.status(403)
			.type("html")
			.send(
				"<!doctype html><title>403 Forbidden</title><p>Admin access required.</p>",
			);
	};
}
