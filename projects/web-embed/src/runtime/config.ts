import { requireEnv } from "./require-env";

export const CANONICAL_APP_ORIGIN = "https://readplace.com";
export const CANONICAL_EMBED_ORIGIN = "https://readplace.com/embed";

export interface EmbedAppOrigins {
	appOrigin: string;
	embedOrigin: string;
}

export interface AppConfig extends EmbedAppOrigins {
	port: number;
}

export function loadOriginsFromEnv(): EmbedAppOrigins {
	return {
		appOrigin: requireEnv("APP_ORIGIN"),
		embedOrigin: requireEnv("EMBED_ORIGIN"),
	};
}

export function loadConfigFromEnv(): AppConfig {
	return {
		port: Number.parseInt(requireEnv("PORT"), 10),
		...loadOriginsFromEnv(),
	};
}
