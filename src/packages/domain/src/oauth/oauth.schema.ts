import { z } from "zod";
import type { OAuthClientId, AccessToken, RefreshToken, AuthorizationCode } from "./oauth.types";

export const OAuthClientIdSchema = z.string().transform((s): OAuthClientId => s as OAuthClientId);

export const AccessTokenSchema = z.string().transform((s): AccessToken => s as AccessToken);

export const RefreshTokenSchema = z.string().transform((s): RefreshToken => s as RefreshToken);

export const AuthorizationCodeSchema = z.string().transform((s): AuthorizationCode => s as AuthorizationCode);
