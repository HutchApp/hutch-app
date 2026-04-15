import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { SaveFailedPage } from "./save-failed.component";

const SaveUrlSchema = z.url();

function parseUrl(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const parsed = SaveUrlSchema.safeParse(raw);
	return parsed.success ? parsed.data : undefined;
}

function originPath(urlString: string): string {
	const u = new URL(urlString);
	return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

function hostOf(urlString: string): string {
	return new URL(urlString).hostname;
}

type ResolveResult =
	| { kind: "ok"; url: string }
	| { kind: "none" }
	| { kind: "mismatch"; queryUrl: string; referer: string };

function resolveSaveUrl(input: {
	queryUrl: string | undefined;
	referer: string | undefined;
	appHost: string;
}): ResolveResult {
	const q = parseUrl(input.queryUrl);
	const rawRef = parseUrl(input.referer);
	// Referers from our own host (e.g. /login after round-trip) are never the URL the user wants to save.
	const ref = rawRef && hostOf(rawRef) !== input.appHost ? rawRef : undefined;

	if (q && ref) {
		return originPath(q) === originPath(ref)
			? { kind: "ok", url: q }
			: { kind: "mismatch", queryUrl: q, referer: ref };
	}
	if (q) return { kind: "ok", url: q };
	if (ref) return { kind: "ok", url: ref };
	return { kind: "none" };
}

export function initSaveRoutes(): Router {
	const router = express.Router();

	router.get("/", (req, res) => {
		const queryUrl = typeof req.query.url === "string" ? req.query.url : undefined;
		const referer = req.get("Referer");

		const result = resolveSaveUrl({ queryUrl, referer, appHost: req.hostname });

		if (result.kind === "mismatch") {
			const page = SaveFailedPage({ queryUrl: result.queryUrl, referer: result.referer }).to("text/html");
			res.status(400).type("html").send(page.body);
			return;
		}

		if (result.kind === "none") {
			res.redirect(303, req.userId ? "/queue" : "/");
			return;
		}

		const url = result.url;

		if (!req.userId) {
			// After login the cross-origin Referer is gone — carry the URL as ?url= so the round-trip can recover it.
			const returnPath = queryUrl
				? req.originalUrl
				: `/save?url=${encodeURIComponent(url)}`;
			res.redirect(303, `/login?return=${encodeURIComponent(returnPath)}`);
			return;
		}

		res.redirect(303, `/queue?url=${encodeURIComponent(url)}`);
	});

	return router;
}
