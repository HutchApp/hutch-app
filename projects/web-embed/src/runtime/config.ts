import { requireEnv } from "./require-env";

export const CANONICAL_APP_ORIGIN = "https://readplace.com";
export const CANONICAL_EMBED_ORIGIN = "https://embed.readplace.com";

export interface AppConfig {
	port: number;
	appOrigin: string;
	embedOrigin: string;
}

export function loadConfigFromEnv(): AppConfig {
	const port = Number.parseInt(requireEnv("PORT"), 10);
	const appOrigin = requireEnv("APP_ORIGIN");
	const embedOrigin = requireEnv("EMBED_ORIGIN");
	return { port, appOrigin, embedOrigin };
}
