export function isAppUrl(urls: { tabUrl: string; serverUrl: string }): boolean {
	try {
		const tabOrigin = new URL(urls.tabUrl).origin;
		const serverOrigin = new URL(urls.serverUrl).origin;
		return tabOrigin === serverOrigin;
	} catch {
		return false;
	}
}
