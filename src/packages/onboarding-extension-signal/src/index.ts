export const COOKIE_NAME = "hutch_ext_installed";
export const COOKIE_VALUE = "1";

export const DISMISS_COOKIE_NAME = "hutch_onboarding_dismissed";

/** Called by the browser extension content script on Readplace pages. */
export function markExtensionInstalled(): void {
	document.cookie = `${COOKIE_NAME}=${COOKIE_VALUE}; path=/; max-age=31536000; SameSite=Lax`;
}
