import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { collectUtmParams } from "../../shared/utm";
import { SaveErrorPage } from "./save-error.component";

const SaveUrlSchema = z.url();

function parseUrl(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const parsed = SaveUrlSchema.safeParse(raw);
	return parsed.success ? parsed.data : undefined;
}

export function initSaveRoutes(): Router {
	const router = express.Router();

	router.get("/", (req, res) => {
		const url = parseUrl(typeof req.query.url === "string" ? req.query.url : undefined);

		if (!url) {
			const redirectUrl = req.userId ? "/queue" : "/";
			const linkLabel = req.userId ? "Go to your queue" : "Go to homepage";
			const html = SaveErrorPage({ redirectUrl, linkLabel }).to("text/html");
			res.status(html.statusCode).type("html").send(html.body);
			return;
		}

		if (!req.userId) {
			res.redirect(303, `/login?return=${encodeURIComponent(req.originalUrl)}`);
			return;
		}

		const utm = collectUtmParams(req.query);
		const qs = new URLSearchParams([["url", url], ...utm]).toString();
		res.redirect(303, `/queue?${qs}`);
	});

	return router;
}
