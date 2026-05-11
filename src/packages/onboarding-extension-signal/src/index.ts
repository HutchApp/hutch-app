/** Legacy cookie written by deployed extension content scripts. The server
 * ignores it for onboarding — see ALIVE_COOKIE_NAME. */
export const COOKIE_NAME = "hutch_ext_installed";
export const COOKIE_VALUE = "1";

/** httpOnly cookie set by the server on every Siren request. Only the
 * extension makes Siren requests, so when it's uninstalled the cookie
 * lapses and the onboarding "install" step flips back to incomplete. */
export const ALIVE_COOKIE_NAME = "hutch_ext_alive";
export const ALIVE_COOKIE_VALUE = "1";

/** Shared TTL for all extension-liveness cookies (alive + saved). Long
 * enough that an active user doesn't see onboarding flicker; short enough
 * that an uninstall surfaces within a month. */
export const EXTENSION_LIVENESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** httpOnly cookie set on extension saves only (not web-form saves).
 * Renewed by the middleware while present so it tracks extension liveness. */
export const SAVE_COOKIE_NAME = "hutch_ext_saved";
export const SAVE_COOKIE_VALUE = "1";

export const DISMISS_COOKIE_NAME = "hutch_onboarding_dismissed";

/** Kept for compatibility with deployed extension versions that bundle
 * this function. The cookie it writes is not used for onboarding. */
export function markExtensionInstalled(): void {
	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is unavailable in Firefox/Safari content scripts; document.cookie is the cross-browser path
	document.cookie = `${COOKIE_NAME}=${COOKIE_VALUE}; path=/; max-age=31536000; SameSite=Lax`;
}
