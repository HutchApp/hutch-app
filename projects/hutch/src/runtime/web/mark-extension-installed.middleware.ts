import type { Request, Response, NextFunction } from "express";
import {
	ALIVE_COOKIE_NAME,
	ALIVE_COOKIE_VALUE,
	EXTENSION_LIVENESS_TTL_MS,
	SAVE_COOKIE_NAME,
	SAVE_COOKIE_VALUE,
} from "@packages/onboarding-extension-signal";
import { wantsSiren } from "./content-negotiation";

/** Sets httpOnly liveness cookies on every Siren response (which only the
 * extension makes). Also refreshes hutch_ext_saved while present so both
 * cookies lapse together after uninstall. */
export function initMarkExtensionInstalled() {
	return (req: Request, res: Response, next: NextFunction) => {
		if (wantsSiren(req)) {
			res.cookie(ALIVE_COOKIE_NAME, ALIVE_COOKIE_VALUE, {
				path: "/",
				maxAge: EXTENSION_LIVENESS_TTL_MS,
				sameSite: "lax",
				httpOnly: true,
			});
			if (req.cookies?.[SAVE_COOKIE_NAME] === SAVE_COOKIE_VALUE) {
				res.cookie(SAVE_COOKIE_NAME, SAVE_COOKIE_VALUE, {
					path: "/",
					maxAge: EXTENSION_LIVENESS_TTL_MS,
					sameSite: "lax",
					httpOnly: true,
				});
			}
		}
		next();
	};
}
