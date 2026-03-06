# Siren Hypermedia API and OAuth 2.0 Interfaces

This document describes the input/output interfaces for the Hutch API.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              FIREFOX EXTENSION                                    │
│                           (Public OAuth Client)                                   │
└────────────────────┬─────────────────────────────────┬───────────────────────────┘
                     │                                 │
                     │ OAuth 2.0 + PKCE                │ Bearer Token
                     │ (Authorization Code Flow)       │ (API Access)
                     ▼                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 HUTCH SERVER                                      │
│                                                                                   │
│  ┌────────────────────────────────┐    ┌────────────────────────────────────┐   │
│  │        OAuth Routes            │    │          API Routes                 │   │
│  │        /oauth/*                │    │          /api/*                     │   │
│  │                                │    │                                     │   │
│  │  INPUT:                        │    │  INPUT:                             │   │
│  │  ├─ GET /authorize             │    │  ├─ Authorization: Bearer <token>   │   │
│  │  │   ?client_id                │    │  ├─ Content-Type: application/json  │   │
│  │  │   ?redirect_uri             │    │  └─ Request body (for POST/PUT)     │   │
│  │  │   ?response_type=code       │    │                                     │   │
│  │  │   ?code_challenge           │    │  OUTPUT:                            │   │
│  │  │   ?code_challenge_method    │    │  ├─ Content-Type: application/      │   │
│  │  │   ?state (optional)         │    │  │  vnd.siren+json                  │   │
│  │  │                             │    │  ├─ Siren Entity with:              │   │
│  │  ├─ POST /authorize            │    │  │   ├─ class[]                     │   │
│  │  │   action=approve|deny       │    │  │   ├─ properties{}                │   │
│  │  │                             │    │  │   ├─ entities[] (sub-entities)   │   │
│  │  ├─ POST /token                │    │  │   ├─ links[] (navigation)        │   │
│  │  │   grant_type                │    │  │   └─ actions[] (state-dependent) │   │
│  │  │   code + code_verifier      │    │  │                                  │   │
│  │  │   OR refresh_token          │    │  └─ HTTP Status Codes:              │   │
│  │  │                             │    │      200, 201, 204, 400, 401, 404   │   │
│  │  ├─ POST /revoke               │    │                                     │   │
│  │  │   token                     │    │                                     │   │
│  │  │                             │    │                                     │   │
│  │  └─ GET /callback              │    │                                     │   │
│  │      (completion page)         │    │                                     │   │
│  │                                │    │                                     │   │
│  │  OUTPUT:                       │    │                                     │   │
│  │  ├─ 302 redirect with code     │    │                                     │   │
│  │  ├─ JSON token response        │    │                                     │   │
│  │  └─ JSON error response        │    │                                     │   │
│  └────────────────┬───────────────┘    └─────────────────┬──────────────────┘   │
│                   │                                      │                       │
│                   ▼                                      ▼                       │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                           OAuth Model                                       │  │
│  │                    (Authorization & Token Storage)                          │  │
│  │                                                                             │  │
│  │  INTERFACE:                                                                 │  │
│  │  ├─ getClient(clientId) → Client | Falsey                                   │  │
│  │  ├─ saveAuthorizationCode(code, client, user) → AuthorizationCode           │  │
│  │  ├─ getAuthorizationCode(code) → AuthorizationCode | Falsey                 │  │
│  │  ├─ revokeAuthorizationCode(code) → boolean                                 │  │
│  │  ├─ saveToken(token, client, user) → Token                                  │  │
│  │  ├─ getAccessToken(accessToken) → Token | Falsey                            │  │
│  │  ├─ getRefreshToken(refreshToken) → RefreshToken | Falsey                   │  │
│  │  ├─ revokeToken(token) → boolean                                            │  │
│  │  └─ verifyScope(token, scope) → boolean                                     │  │
│  │                                                                             │  │
│  │  STORAGE: In-Memory (dev) → DynamoDB (production, Phase 4)                  │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                        Domain Providers                                      │  │
│  │                                                                              │  │
│  │  Article Store:                    Auth Provider:                            │  │
│  │  ├─ findArticlesByUser()           ├─ createUser()                           │  │
│  │  ├─ findArticleById()              ├─ verifyCredentials()                    │  │
│  │  ├─ saveArticle()                  ├─ createSession()                        │  │
│  │  ├─ updateArticleStatus()          ├─ getSessionUserId()                     │  │
│  │  └─ deleteArticle()                └─ destroySession()                       │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## OAuth 2.0 Flow (Authorization Code + PKCE)

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   Firefox   │                    │    Hutch    │                    │   OAuth     │
│  Extension  │                    │   Server    │                    │   Model     │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │  1. GET /oauth/authorize         │                                  │
       │     ?client_id=hutch-ff-ext      │                                  │
       │     ?redirect_uri=.../callback   │                                  │
       │     ?response_type=code          │                                  │
       │     ?code_challenge=<S256>       │                                  │
       │     ?code_challenge_method=S256  │                                  │
       │ ─────────────────────────────────>                                  │
       │                                  │                                  │
       │                                  │  2. Validate client_id           │
       │                                  │ ─────────────────────────────────>
       │                                  │                                  │
       │                                  │     Client | Falsey              │
       │                                  │ <─────────────────────────────────
       │                                  │                                  │
       │  3. 200 HTML Authorization Form  │                                  │
       │ <─────────────────────────────────                                  │
       │                                  │                                  │
       │  4. POST /oauth/authorize        │                                  │
       │     action=approve               │                                  │
       │ ─────────────────────────────────>                                  │
       │                                  │                                  │
       │                                  │  5. Save authorization code      │
       │                                  │ ─────────────────────────────────>
       │                                  │                                  │
       │  6. 302 Redirect to              │                                  │
       │     redirect_uri?code=<code>     │                                  │
       │ <─────────────────────────────────                                  │
       │                                  │                                  │
       │  7. POST /oauth/token            │                                  │
       │     grant_type=authorization_code│                                  │
       │     code=<code>                  │                                  │
       │     code_verifier=<verifier>     │                                  │
       │ ─────────────────────────────────>                                  │
       │                                  │                                  │
       │                                  │  8. Get & validate code (PKCE)   │
       │                                  │ ─────────────────────────────────>
       │                                  │                                  │
       │                                  │  9. Revoke code, save tokens     │
       │                                  │ ─────────────────────────────────>
       │                                  │                                  │
       │  10. JSON Token Response         │                                  │
       │      { access_token, refresh_token, expires_in }                    │
       │ <─────────────────────────────────                                  │
       │                                  │                                  │
```

## API Routes (Siren Hypermedia)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API ENDPOINTS                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  GET /api                         → Root entity with navigation links            │
│  ├─ links: [self, articles, me]                                                  │
│  └─ class: ["root"]                                                              │
│                                                                                  │
│  GET /api/me                      → Current user entity                          │
│  ├─ properties: { userId }                                                       │
│  └─ class: ["user"]                                                              │
│                                                                                  │
│  GET /api/articles                → Collection with pagination                   │
│  ├─ properties: { total, page, pageSize }                                        │
│  ├─ entities: [ embedded sub-entities (no content) ]                             │
│  ├─ links: [self, root, next?, prev?]                                            │
│  ├─ actions: [save-article, filter-by-status]                                    │
│  └─ class: ["collection", "articles"]                                            │
│                                                                                  │
│  POST /api/articles               → Create article (returns full entity)         │
│  ├─ INPUT: { url: string }                                                       │
│  └─ OUTPUT: Article entity with status=unread                                    │
│                                                                                  │
│  GET /api/articles/:id            → Full article entity with content             │
│  ├─ properties: { id, url, title, content, status, ... }                         │
│  ├─ links: [self, collection, root]                                              │
│  ├─ actions: [mark-read|mark-unread, archive, delete] (state-dependent)          │
│  └─ class: ["article"]                                                           │
│                                                                                  │
│  PUT /api/articles/:id/status     → Update article status                        │
│  ├─ INPUT: { status: "read" | "unread" | "archived" }                            │
│  └─ OUTPUT: Updated article entity                                               │
│                                                                                  │
│  DELETE /api/articles/:id         → Delete article                               │
│  └─ OUTPUT: 204 No Content                                                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## State-Dependent Actions

```
┌────────────────────┬─────────────────────────────────────────────────────────────┐
│  Article Status    │  Available Actions                                          │
├────────────────────┼─────────────────────────────────────────────────────────────┤
│  unread            │  mark-read, archive, delete                                 │
│  read              │  mark-unread, archive, delete                               │
│  archived          │  mark-read, mark-unread, delete                             │
└────────────────────┴─────────────────────────────────────────────────────────────┘

The server controls which actions are available based on resource state.
Clients follow actions, never hardcode business logic.
```

## Error Responses (Siren-compatible)

```json
{
  "class": ["error"],
  "properties": {
    "code": "invalid-token",
    "message": "The access token is invalid or expired"
  }
}
```

HTTP Status Codes:
- 400 Bad Request (validation errors)
- 401 Unauthorized (missing/invalid token)
- 404 Not Found (resource not found)
- 422 Unprocessable Entity (business rule violations)

## Files Declaring These Interfaces

| Interface | File |
|-----------|------|
| OAuth Routes | [`web/oauth/oauth.routes.ts`](../src/runtime/web/oauth/oauth.routes.ts) |
| OAuth Model | [`providers/oauth/oauth-model.ts`](../src/runtime/providers/oauth/oauth-model.ts) |
| OAuth Client Registry | [`providers/oauth/oauth-clients.ts`](../src/runtime/providers/oauth/oauth-clients.ts) |
| API Routes | [`web/api/api.routes.ts`](../src/runtime/web/api/api.routes.ts) |
| Siren Types | [`web/api/siren.ts`](../src/runtime/web/api/siren.ts) |
| Article Siren Mapper | [`web/api/article-siren.ts`](../src/runtime/web/api/article-siren.ts) |
| Collection Siren Mapper | [`web/api/collection-siren.ts`](../src/runtime/web/api/collection-siren.ts) |
| API Auth Middleware | [`web/api/api.middleware.ts`](../src/runtime/web/api/api.middleware.ts) |
