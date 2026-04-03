import type { QualifyLink, QualifyLinkResult } from "./gmail-import.types";

export const qualifyLink: QualifyLink = (url: string): QualifyLinkResult => {
	if (!url || url.trim() === "") {
		return { ok: false, reason: "empty-url" };
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, reason: "invalid-url" };
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, reason: "unsupported-protocol" };
	}

	if (!parsed.hostname) {
		return { ok: false, reason: "missing-hostname" };
	}

	return { ok: true, url: parsed.href };
};
