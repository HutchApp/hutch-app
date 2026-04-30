export function isSaveableScheme(params: {
	tabUrl: string;
	allowedSchemes: readonly string[];
}): boolean {
	try {
		const protocol = new URL(params.tabUrl).protocol.replace(/:$/, "");
		return params.allowedSchemes.includes(protocol);
	} catch {
		return false;
	}
}
