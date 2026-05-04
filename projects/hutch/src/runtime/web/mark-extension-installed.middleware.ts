import type { Request, Response, NextFunction } from "express";
import {
	COOKIE_NAME,
	COOKIE_VALUE,
} from "@packages/onboarding-extension-signal";
import { wantsSiren } from "./content-negotiation";

/** Sets the extension-installed cookie on every authenticated Siren
 * response so the onboarding UI can detect the extension is present.
 * Siren + userId means the request came from the browser extension
 * (Bearer-token auth); browser-session requests never send Siren Accept. */
export function initMarkExtensionInstalled() {
	return (req: Request, res: Response, next: NextFunction) => {
		if (wantsSiren(req) && req.userId) {
			res.cookie(COOKIE_NAME, COOKIE_VALUE, {
				path: "/",
				maxAge: 365 * 24 * 60 * 60 * 1000,
				sameSite: "lax",
			});
		}
		next();
	};
}
