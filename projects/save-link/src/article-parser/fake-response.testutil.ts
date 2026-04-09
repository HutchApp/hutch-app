export function createFakeResponse(overrides: {
	status?: number;
	ok?: boolean;
	contentType?: string;
	text?: string;
	etag?: string;
	lastModified?: string;
}): Partial<Response> {
	const { status = 200, ok = true, contentType = "text/html", text = "" } = overrides;
	const headers = new Headers({ "content-type": contentType });
	if (overrides.etag) headers.set("etag", overrides.etag);
	if (overrides.lastModified) headers.set("last-modified", overrides.lastModified);
	return {
		status,
		ok,
		headers,
		text: async () => text,
	};
}
