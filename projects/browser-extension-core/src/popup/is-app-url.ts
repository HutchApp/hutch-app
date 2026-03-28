export function isAppUrl(tabUrl: string, serverUrl: string): boolean {
	try {
		const tabOrigin = new URL(tabUrl).origin;
		const serverOrigin = new URL(serverUrl).origin;
		return tabOrigin === serverOrigin;
	} catch {
		return false;
	}
}
