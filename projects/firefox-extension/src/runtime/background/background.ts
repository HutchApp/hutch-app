import {
	initHutchOAuthAuth,
	createBrowserWindowApi,
} from "../providers/auth/hutch-oauth-auth";
import { initHutchApiReadingList } from "../providers/reading-list/hutch-api-reading-list";
import { initBackground } from "./init-background";

declare const HUTCH_SERVER_URL: string;

const auth = initHutchOAuthAuth({
	serverUrl: HUTCH_SERVER_URL,
	windowApi: createBrowserWindowApi(),
	fetchFn: fetch,
});
const readingList = initHutchApiReadingList({
	serverUrl: HUTCH_SERVER_URL,
	getAccessToken: auth.getAccessToken,
	fetchFn: fetch,
});

initBackground({ auth, readingList });
