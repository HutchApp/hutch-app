import type { Router } from "express";
import express from "express";
import { z } from "zod";

const SaveUrlSchema = z.url();

export function initSaveRoutes(): Router {
	const router = express.Router();

	router.get("/", (req, res) => {
		const raw = typeof req.query.url === "string" ? req.query.url : undefined;
		const parsed = SaveUrlSchema.safeParse(raw);
		const url = parsed.success ? parsed.data : undefined;

		if (!url) {
			res.redirect(303, req.userId ? "/queue" : "/");
			return;
		}

		if (!req.userId) {
			const returnUrl = encodeURIComponent(req.originalUrl);
			res.redirect(303, `/login?return=${returnUrl}`);
			return;
		}

		res.redirect(303, `/queue?url=${encodeURIComponent(url)}`);
	});

	return router;
}
