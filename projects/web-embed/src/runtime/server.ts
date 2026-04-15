import type { Express } from "express";
import express from "express";
import helmet from "helmet";
import type { EmbedAppOrigins } from "./config";
import { renderEmbedPage } from "./embed";
import { EMBED_ICON_SVG } from "./icon";
import { renderPreviewPage } from "./preview";

export function createApp(config: EmbedAppOrigins): Express {
	const app = express();

	app.use(
		helmet({
			// CSP disabled: the embed demo inlines publisher snippets as literal HTML so
			// readers can copy them; a strict CSP would block the inline <script> that
			// wires the copy buttons. crossOriginResourcePolicy is relaxed so the icon.svg
			// can be hotlinked from publishers' pages across origins.
			contentSecurityPolicy: false,
			crossOriginEmbedderPolicy: false,
			crossOriginResourcePolicy: { policy: "cross-origin" },
		}),
	);

	const embedRouter = express.Router();

	embedRouter.get("/", (_req, res) => {
		const html = renderEmbedPage({
			appOrigin: config.appOrigin,
			embedOrigin: config.embedOrigin,
		});
		res.type("html").send(html);
	});

	embedRouter.get("/preview", (_req, res) => {
		const html = renderPreviewPage({
			appOrigin: config.appOrigin,
			embedOrigin: config.embedOrigin,
		});
		res.type("html").send(html);
	});

	embedRouter.get("/icon.svg", (_req, res) => {
		res
			.type("image/svg+xml")
			.set("Cache-Control", "public, max-age=31536000, immutable")
			.send(EMBED_ICON_SVG);
	});

	embedRouter.get("/health", (_req, res) => {
		res.type("text/plain").send("ok");
	});

	app.use("/embed", embedRouter);

	app.use((_req, res) => {
		res.status(404).type("text/plain").send("Not found");
	});

	return app;
}
