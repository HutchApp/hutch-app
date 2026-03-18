export const EXTENSION_VIEW_IDS = [
	"login-view",
	"saved-view",
	"already-saved-view",
	"removed-view",
	"list-view",
	"loading-view",
] as const;

export type ExtensionViewId = (typeof EXTENSION_VIEW_IDS)[number];

export const SERVER_PAGES = [
	{ className: "page-login", view: "server-login" },
	{ className: "page-oauth-authorize", view: "oauth-authorize" },
] as const;

export const TRANSITIONING_VIEW = "transitioning";

export const ELEMENT_IDS = {
	loginButton: "login-button",
	loginError: "login-error",
	undoButton: "undo-button",
	logoutButton: "logout-button",
	filterInput: "filter-input",
	linkList: "link-list",
	pagination: "pagination",
	emptyList: "empty-list",
	noMatches: "no-matches",
	listError: "list-error",
	emailInput: "email",
	passwordInput: "password",
} as const;

export const CSS_SELECTORS = {
	submitButton: 'button[type="submit"]',
	approveButton: 'button[value="approve"]',
	listItem: "#link-list .list-view__item",
	listItemTitle: "#link-list .list-view__item-title",
} as const;
