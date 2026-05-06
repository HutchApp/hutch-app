export type OAuthClientId = string & { readonly __brand: "OAuthClientId" };
export type AuthorizationCode = string & { readonly __brand: "AuthorizationCode" };
export type AccessToken = string & { readonly __brand: "AccessToken" };
export type RefreshToken = string & { readonly __brand: "RefreshToken" };

export interface OAuthClient {
	id: OAuthClientId;
	name: string;
	redirectUris: string[];
	grants: string[];
}
