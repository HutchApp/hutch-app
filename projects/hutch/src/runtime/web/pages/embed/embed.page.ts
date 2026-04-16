import express, { type Router } from "express";
import helmet from "helmet";
import { EmbedPage } from "./embed.component";
import { PreviewPage } from "./preview.component";
import { EMBED_ICON_SVG } from "./icon";

export function initEmbedRoutes(deps: { appOrigin: string }): Router {
	const embedOrigin = `${deps.appOrigin}/embed`;
	const router = express.Router();

	router.use(
		helmet({
			contentSecurityPolicy: false,
			crossOriginEmbedderPolicy: false,
			crossOriginResourcePolicy: { policy: "cross-origin" },
		}),
	);

	router.get("/", (_req, res) => {
		const result = EmbedPage({ appOrigin: deps.appOrigin, embedOrigin }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.get("/preview", (_req, res) => {
		const result = PreviewPage({ appOrigin: deps.appOrigin, embedOrigin }).to("text/html");
		res.status(result.statusCode).type("html").send(result.body);
	});

	router.get("/icon.svg", (_req, res) => {
		res
			.type("image/svg+xml")
			.set("Cache-Control", "public, max-age=31536000, immutable")
			.send(EMBED_ICON_SVG);
	});

	return router;
}
