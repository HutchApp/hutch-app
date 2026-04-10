/* c8 ignore start -- type-only file, no runtime code */
import type { GoogleId } from "./google-auth.schema";

export interface GoogleTokenResult {
	googleId: GoogleId;
	email: string;
	emailVerified: boolean;
}

export type ExchangeGoogleCode = (code: string) => Promise<GoogleTokenResult>;
