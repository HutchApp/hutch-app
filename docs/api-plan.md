# Hutch API Plan — Firefox Extension Integration

## Goal

Expose a **hypermedia API** from the hutch-app web application so the Firefox extension (and any future client) can read/write the same DynamoDB data as the website. The API uses **Siren** (`application/vnd.siren+json`) as its hypermedia format, enabling a generic client that navigates links and submits actions rather than hardcoding URLs or domain models.

Authentication uses a self-hosted OAuth 2.0 Authorization Code + PKCE flow — no third-party OAuth providers.

### Why Hypermedia / HATEOAS

| Problem with traditional REST | Hypermedia solution |
|-------------------------------|---------------------|
| URL versioning (`/v1/`) couples clients to URL structure | No version in URLs. Server controls all URIs; clients follow `rel` names |
| Domain model changes break clients | Clients read `properties`, `links`, `actions` — they don't import `SavedArticle` |
| Adding a feature requires client update | New `actions` or `links` appear in responses; generic client renders them |
| Client embeds business rules (which status transitions are valid) | Server advertises only valid `actions` for current state |

---

## 1. Current Architecture Summary

| Layer | Key files | Notes |
|-------|-----------|-------|
| Domain types | `domain/article/article.types.ts`, `domain/user/user.types.ts` | Branded `ArticleId`, `UserId`, `Minutes` |
| Auth provider | `providers/auth/dynamodb-auth.ts` | `createUser`, `verifyCredentials`, `createSession`, `getSessionUserId`, `destroySession` |
| Article store | `providers/article-store/dynamodb-article-store.ts` | `saveArticle`, `findArticleById`, `findArticlesByUser`, `deleteArticle`, `updateArticleStatus` |
| Session store | Same DynamoDB auth provider | 7-day TTL sessions in `hutch-sessions` table, cookie-based (`hutch_sid`) |
| Web routes | `server.ts` → `auth.page.ts`, `queue.page.ts`, `export.page.ts` | HTML-over-the-wire, forms, SSR |
| Infra | `infra/index.ts` | 3 DynamoDB tables (`hutch-articles`, `hutch-users`, `hutch-sessions`), Lambda + API Gateway |

The website currently uses cookie-based sessions. The Firefox extension cannot share cookies across origins, so it needs a token-based auth mechanism — hence OAuth 2.0.

---

## 2. OAuth 2.0 — Self-Hosted (No Third Parties)

### 2.1 Why Authorization Code + PKCE

- The Firefox extension is a **public client** (no secret can be safely embedded).
- PKCE (RFC 7636) protects against authorization code interception.
- The extension opens a tab on hutch-app.com, the user logs in with their existing credentials, and the extension receives tokens — no passwords are ever handled by the extension.

### 2.2 Flow

```
┌──────────────────┐                        ┌────────────────────┐
│ Firefox Extension │                        │   hutch-app.com    │
└────────┬─────────┘                        └─────────┬──────────┘
         │                                            │
         │ 1. Generate code_verifier + code_challenge │
         │                                            │
         │ 2. Open browser tab ───────────────────►   │
         │    GET /oauth/authorize                    │
         │    ?client_id=hutch-firefox-extension      │
         │    &redirect_uri=<extension-redirect>      │
         │    &response_type=code                     │
         │    &code_challenge=<S256-hash>             │
         │    &code_challenge_method=S256             │
         │    &state=<random>                         │
         │                                            │
         │                          3. User sees login│
         │                             (or is already │
         │                              logged in via │
         │                              cookie)       │
         │                                            │
         │                          4. User approves  │
         │                                            │
         │ 5. Redirect back  ◄────────────────────    │
         │    <redirect_uri>?code=<authz_code>        │
         │    &state=<same-random>                    │
         │                                            │
         │ 6. POST /oauth/token  ─────────────────►   │
         │    grant_type=authorization_code            │
         │    &code=<authz_code>                      │
         │    &code_verifier=<original_verifier>      │
         │    &client_id=hutch-firefox-extension      │
         │    &redirect_uri=<extension-redirect>      │
         │                                            │
         │ 7. Receive tokens  ◄────────────────────   │
         │    { access_token, refresh_token,           │
         │      expires_in, token_type: "Bearer" }    │
         │                                            │
         │ 8. API calls with                          │
         │    Authorization: Bearer <access_token> ──►│
         │                                            │
         │ 9. When access_token expires:              │
         │    POST /oauth/token                       │
         │    grant_type=refresh_token  ──────────►   │
         │    &refresh_token=<refresh_token>          │
         │    &client_id=hutch-firefox-extension      │
         │                                            │
         │ 10. New tokens  ◄───────────────────────   │
```

### 2.3 Token Lifetimes

| Token | Lifetime | Storage |
|-------|----------|---------|
| Authorization code | 5 minutes | DynamoDB with TTL |
| Access token | 1 hour | DynamoDB with TTL |
| Refresh token | 30 days | DynamoDB with TTL |

### 2.4 New Domain Types

```
src/runtime/domain/oauth/oauth.types.ts
```

```typescript
export type OAuthClientId = string & { readonly __brand: "OAuthClientId" };
export type AuthorizationCode = string & { readonly __brand: "AuthorizationCode" };
export type AccessToken = string & { readonly __brand: "AccessToken" };
export type RefreshToken = string & { readonly __brand: "RefreshToken" };
```

### 2.5 New DynamoDB Tables

#### `hutch-oauth-codes` (authorization codes, short-lived)

| Attribute | Type | Key |
|-----------|------|-----|
| `code` | S | Hash key |
| `clientId` | S | |
| `userId` | S | |
| `redirectUri` | S | |
| `codeChallenge` | S | |
| `codeChallengeMethod` | S | Always "S256" |
| `expiresAt` | N | TTL attribute |

#### `hutch-oauth-tokens` (access + refresh tokens)

| Attribute | Type | Key |
|-----------|------|-----|
| `accessToken` | S | Hash key |
| `refreshToken` | S | |
| `clientId` | S | |
| `userId` | S | |
| `expiresAt` | N | TTL attribute |

GSI on `refreshToken` (hash key) for the refresh flow.

GSI on `userId` (hash key) for revoking all tokens when a user changes password or deletes account.

### 2.6 Client Registration

The Firefox extension is a **pre-registered client** — no dynamic client registration. Client metadata is stored in application config (not in DynamoDB):

```typescript
const REGISTERED_CLIENTS: Record<string, OAuthClient> = {
  "hutch-firefox-extension": {
    clientId: "hutch-firefox-extension" as OAuthClientId,
    name: "Hutch Firefox Extension",
    redirectUris: [
      "https://extensions.hutch-app.com/callback",
      "http://127.0.0.1/callback",  // local development
    ],
  },
};
```

Using static registration avoids a DynamoDB table for clients and keeps the trust boundary explicit. New clients require a code change — this is intentional for a privacy-first app.

---

## 3. OAuth Provider (Persistence Layer)

Following the existing `init*` partial-application pattern:

```
src/runtime/providers/oauth/oauth.types.ts        — type definitions
src/runtime/providers/oauth/dynamodb-oauth.ts      — DynamoDB implementation
src/runtime/providers/oauth/in-memory-oauth.ts     — in-memory for development
```

### 3.1 Provider Interface

```typescript
type StoreAuthorizationCode = (params: {
  code: AuthorizationCode;
  clientId: OAuthClientId;
  userId: UserId;
  redirectUri: string;
  codeChallenge: string;
}) => Promise<void>;

type ExchangeAuthorizationCode = (params: {
  code: AuthorizationCode;
  clientId: OAuthClientId;
  codeVerifier: string;
  redirectUri: string;
}) => Promise<
  | { ok: true; userId: UserId }
  | { ok: false; reason: "invalid-code" | "invalid-verifier" | "expired" | "client-mismatch" | "redirect-mismatch" }
>;

type CreateTokenPair = (params: {
  clientId: OAuthClientId;
  userId: UserId;
}) => Promise<{
  accessToken: AccessToken;
  refreshToken: RefreshToken;
  expiresIn: number;
}>;

type ValidateAccessToken = (accessToken: AccessToken) => Promise<UserId | null>;

type RefreshAccessToken = (params: {
  refreshToken: RefreshToken;
  clientId: OAuthClientId;
}) => Promise<
  | { ok: true; accessToken: AccessToken; refreshToken: RefreshToken; expiresIn: number }
  | { ok: false; reason: "invalid-token" | "expired" | "client-mismatch" }
>;

type RevokeToken = (accessToken: AccessToken) => Promise<void>;

type RevokeAllUserTokens = (userId: UserId) => Promise<void>;
```

### 3.2 PKCE Verification

The `ExchangeAuthorizationCode` operation:
1. Retrieves the stored code from DynamoDB
2. Verifies it has not expired
3. Verifies `clientId` and `redirectUri` match
4. Computes `SHA256(code_verifier)` and compares to stored `codeChallenge`
5. Deletes the code (single-use)
6. Returns the `userId`

### 3.3 Token Rotation (Single-Use Refresh Tokens)

The `RefreshAccessToken` operation enforces single-use refresh tokens as specified in section 10 (Security Considerations):

1. Looks up the token record by `refreshToken` via the GSI
2. Verifies the token has not expired and `clientId` matches
3. **Deletes the existing token record** (invalidating both the old access token and old refresh token)
4. Creates a **new token record** with a new access token AND a new refresh token
5. Returns the new `accessToken`, new `refreshToken`, and `expiresIn`

**Important:** The client MUST store the new `refreshToken` from each refresh response. The old refresh token is immediately invalidated after use. This prevents refresh token replay attacks — a stolen refresh token can only be used once before the legitimate client's next refresh invalidates it.

---

## 4. Hypermedia API (Siren)

### 4.1 Design Principles

1. **The API root is the only URL the client knows.** Everything else is discovered via `links` and `actions` in Siren responses.
2. **No URL versioning.** Evolvability comes from hypermedia affordances — adding new `links`/`actions` is non-breaking; removing them is a breaking change.
3. **Domain models stay on the server.** The client never imports `SavedArticle` or `ArticleStatus`. It reads `properties` and submits `actions` with `fields` — a generic Siren client.
4. **State-dependent actions.** The server only includes actions the user can perform on the current resource (e.g., an `"unread"` article has `mark-read` and `archive` actions; a `"read"` article has `mark-unread` and `archive`).

### 4.2 Media Type

All API responses use:

```
Content-Type: application/vnd.siren+json
```

The client sends:

```
Accept: application/vnd.siren+json
Authorization: Bearer <access_token>
```

### 4.3 API Root — The Single Entry Point

```
GET /api
```

The **only hardcoded URL** in the Firefox extension. Everything else is discovered.

```json
{
  "class": ["root"],
  "properties": {},
  "links": [
    { "rel": ["self"], "href": "/api" },
    { "rel": ["articles"], "href": "/api/articles" },
    { "rel": ["current-user"], "href": "/api/me" }
  ],
  "actions": [
    {
      "name": "save-article",
      "href": "/api/articles",
      "method": "POST",
      "type": "application/json",
      "fields": [
        { "name": "url", "type": "url" }
      ]
    }
  ]
}
```

The extension navigates by following `rel` names:
- `"articles"` → article collection
- `"current-user"` → user info
- `"save-article"` action → POST a new article

### 4.4 Article Collection

```
GET /api/articles
GET /api/articles?status=unread&order=desc&page=2&pageSize=20
```

The collection URL is discovered from the root's `rel: ["articles"]` link. Query parameters are the only client-constructed part — and even these are discoverable via link templates (see 4.4.2).

#### 4.4.1 Response

```json
{
  "class": ["collection", "articles"],
  "properties": {
    "total": 42,
    "page": 1,
    "pageSize": 20
  },
  "entities": [
    {
      "class": ["article"],
      "rel": ["item"],
      "properties": {
        "url": "https://example.com/article",
        "title": "Article Title",
        "siteName": "Example",
        "excerpt": "First paragraph...",
        "wordCount": 1200,
        "estimatedReadTimeMinutes": 5,
        "status": "unread",
        "savedAt": "2026-03-04T10:00:00.000Z",
        "readAt": null
      },
      "links": [
        { "rel": ["self"], "href": "/api/articles/abc123" }
      ]
    }
  ],
  "links": [
    { "rel": ["self"], "href": "/api/articles?page=1&pageSize=20&order=desc" },
    { "rel": ["next"], "href": "/api/articles?page=2&pageSize=20&order=desc" },
    { "rel": ["root"], "href": "/api" }
  ],
  "actions": [
    {
      "name": "save-article",
      "href": "/api/articles",
      "method": "POST",
      "type": "application/json",
      "fields": [
        { "name": "url", "type": "url" }
      ]
    },
    {
      "name": "filter-by-status",
      "href": "/api/articles",
      "method": "GET",
      "fields": [
        { "name": "status", "type": "text" },
        { "name": "order", "type": "text" },
        { "name": "page", "type": "number" },
        { "name": "pageSize", "type": "number" }
      ]
    }
  ]
}
```

Key behaviors:
- **`entities`** are embedded sub-entities with `rel: ["item"]`. Each has a `self` link for the full representation (including `content`).
- **`next`/`prev` links** only appear when there are more pages. The client never constructs pagination URLs — it follows links.
- **`save-article` action** tells the client exactly how to create an article (method, fields, content type).
- **`filter-by-status` action** makes query parameters discoverable. A generic Siren client can render this as a form.
- **`content` is omitted** from embedded entities (bandwidth). Follow the `self` link for full content.

#### 4.4.2 Pagination Links

| Condition | Links present |
|-----------|--------------|
| First page, more pages exist | `self`, `next` |
| Middle page | `self`, `prev`, `next` |
| Last page | `self`, `prev` |
| Only one page | `self` |

### 4.5 Single Article

Discovered by following an embedded entity's `rel: ["self"]` link.

```
GET /api/articles/:id
```

```json
{
  "class": ["article"],
  "properties": {
    "url": "https://example.com/article",
    "title": "Article Title",
    "siteName": "Example",
    "excerpt": "First paragraph...",
    "wordCount": 1200,
    "estimatedReadTimeMinutes": 5,
    "content": "<p>Full article HTML content...</p>",
    "status": "unread",
    "savedAt": "2026-03-04T10:00:00.000Z",
    "readAt": null
  },
  "links": [
    { "rel": ["self"], "href": "/api/articles/abc123" },
    { "rel": ["collection"], "href": "/api/articles" },
    { "rel": ["root"], "href": "/api" }
  ],
  "actions": [
    {
      "name": "mark-read",
      "href": "/api/articles/abc123/status",
      "method": "PUT",
      "type": "application/json",
      "fields": [
        { "name": "status", "type": "hidden", "value": "read" }
      ]
    },
    {
      "name": "archive",
      "href": "/api/articles/abc123/status",
      "method": "PUT",
      "type": "application/json",
      "fields": [
        { "name": "status", "type": "hidden", "value": "archived" }
      ]
    },
    {
      "name": "delete",
      "href": "/api/articles/abc123",
      "method": "DELETE"
    }
  ]
}
```

Key behaviors:
- **State-dependent actions**: An `"unread"` article shows `mark-read` + `archive`. A `"read"` article shows `mark-unread` + `archive`. An `"archived"` article shows `mark-unread` + `mark-read`. The client never decides which transitions are valid — the server controls this.
- **`hidden` fields with `value`**: The `mark-read` action pre-fills `status: "read"`. The client just submits the action without knowing what status values exist.
- **`content` is included** in the single-article representation (unlike the collection).

#### 4.5.1 Status Transition Actions by Current State

| Current status | Available actions |
|----------------|-------------------|
| `unread` | `mark-read`, `archive`, `delete` |
| `read` | `mark-unread`, `archive`, `delete` |
| `archived` | `mark-unread`, `mark-read`, `delete` |

### 4.6 Current User

```
GET /api/me
```

```json
{
  "class": ["user"],
  "properties": {
    "userId": "a1b2c3..."
  },
  "links": [
    { "rel": ["self"], "href": "/api/me" },
    { "rel": ["articles"], "href": "/api/articles" },
    { "rel": ["root"], "href": "/api" }
  ]
}
```

### 4.7 Action Responses

When a client submits an action, the server returns the resulting Siren entity:

| Action | HTTP | Response |
|--------|------|----------|
| `save-article` | `POST /api/articles` | `201` with the new article entity (same shape as 4.5) |
| `mark-read` / `mark-unread` / `archive` | `PUT /api/articles/:id/status` | `200` with the updated article entity |
| `delete` | `DELETE /api/articles/:id` | `204` No Content |

Returning the full entity after mutations means the client always has up-to-date `links` and `actions` without a second GET request.

### 4.8 Error Responses

Errors use a Siren-compatible shape with `class: ["error"]`:

```json
{
  "class": ["error"],
  "properties": {
    "code": "invalid-url",
    "message": "The provided URL could not be parsed as an article"
  }
}
```

HTTP status codes:
- `400` — Validation error, bad request
- `401` — Missing or invalid token (also returns `WWW-Authenticate: Bearer` header)
- `404` — Resource not found or not owned by user
- `422` — Action could not be completed (e.g., URL not parseable)

### 4.9 OAuth Routes (Not Hypermedia)

OAuth endpoints follow RFC 6749 conventions (form-encoded, not Siren). They are separate from the hypermedia API.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/oauth/authorize` | Show authorization page (HTML, login + consent) |
| `POST` | `/oauth/authorize` | Submit authorization (HTML form) |
| `POST` | `/oauth/token` | Exchange code for tokens / refresh tokens (form-encoded) |
| `POST` | `/oauth/revoke` | Revoke an access token (form-encoded) |

### 4.10 Route Summary

| Method | Path | Content-Type | Purpose |
|--------|------|-------------|---------|
| `GET` | `/api` | `application/vnd.siren+json` | API root (entry point) |
| `GET` | `/api/articles` | `application/vnd.siren+json` | Article collection |
| `POST` | `/api/articles` | `application/vnd.siren+json` | Save article (via action) |
| `GET` | `/api/articles/:id` | `application/vnd.siren+json` | Single article |
| `PUT` | `/api/articles/:id/status` | `application/vnd.siren+json` | Update status (via action) |
| `DELETE` | `/api/articles/:id` | — | Delete article (via action) |
| `GET` | `/api/me` | `application/vnd.siren+json` | Current user |

### 4.11 How the Firefox Extension Uses This

The extension is a **generic Siren client**, not a "hutch API client":

```
1. GET /api                          → discover links & actions
2. Follow rel=["articles"]           → GET /api/articles
3. Render entities as article list
4. User clicks "Save" → find action "save-article" → submit it
5. User clicks article → follow entity's self link → GET /api/articles/:id
6. Render properties + available actions as buttons
7. User clicks "Mark as Read" → find action "mark-read" → submit it
8. Response has updated entity with new actions → re-render
```

The extension never constructs URLs. If the server changes `/api/articles` to `/api/saved-links` tomorrow, the extension keeps working because it follows `rel: ["articles"]`.

### 4.12 Decoupling: Domain Model vs Interchange Format

The server has rich domain types (`SavedArticle`, `ArticleMetadata`, `ArticleId`, `Minutes`). The Siren response is a **separate representation layer**:

```
Domain (server-side)              Siren (wire format)
─────────────────────             ────────────────────
SavedArticle.metadata.title   →  properties.title
SavedArticle.metadata.siteName →  properties.siteName
SavedArticle.estimatedReadTime →  properties.estimatedReadTimeMinutes
SavedArticle.id (branded)      →  links[rel=self].href (opaque URL)
ArticleStatus transitions      →  actions[] (server decides which appear)
```

The client never sees `ArticleId`, `UserId`, `Minutes`, or `ArticleMetadata`. It sees:
- **Properties**: flat key/value pairs to display
- **Links**: URLs to follow (opaque — the client doesn't parse them)
- **Actions**: forms to submit (method, href, fields)

This means:
- Renaming `estimatedReadTime` to `readTimeMinutes` on the server? Just update the Siren serializer. Client unaffected.
- Adding a new status like `"favorite"`? Add a new action to the response. Client shows it automatically.
- Changing the article ID format? URLs change but `rel` names don't. Client unaffected.

---

## 5. Server Integration

### 5.1 Siren Serialization Layer

A thin serialization layer converts domain objects to Siren entities. This layer is the **only place** that knows both the domain types and the Siren format.

```
src/runtime/web/api/siren.ts              — Siren type definitions
src/runtime/web/api/article-siren.ts      — SavedArticle → Siren entity
src/runtime/web/api/collection-siren.ts   — FindArticlesResult → Siren collection
```

```typescript
// siren.ts — Generic Siren types (framework-agnostic)
interface SirenEntity {
  class?: string[];
  properties?: Record<string, unknown>;
  entities?: SirenSubEntity[];
  links?: SirenLink[];
  actions?: SirenAction[];
}

interface SirenLink {
  rel: string[];
  href: string;
}

interface SirenAction {
  name: string;
  href: string;
  method: string;
  type?: string;
  fields?: SirenField[];
}

interface SirenField {
  name: string;
  type: string;
  value?: string | number;
}

interface SirenSubEntity extends SirenEntity {
  rel: string[];
}
```

```typescript
// article-siren.ts — Domain-to-Siren mapper
// This is the boundary between domain types and wire format.
// The client never sees SavedArticle — only SirenEntity.

function toArticleEntity(article: SavedArticle): SirenEntity {
  return {
    class: ["article"],
    properties: {
      url: article.url,
      title: article.metadata.title,
      siteName: article.metadata.siteName,
      excerpt: article.metadata.excerpt,
      wordCount: article.metadata.wordCount,
      estimatedReadTimeMinutes: article.estimatedReadTime as number,
      status: article.status,
      savedAt: article.savedAt.toISOString(),
      readAt: article.readAt?.toISOString() ?? null,
    },
    links: [
      { rel: ["self"], href: `/api/articles/${article.id}` },
      { rel: ["collection"], href: "/api/articles" },
      { rel: ["root"], href: "/api" },
    ],
    actions: actionsForStatus(article),
  };
}

// Server controls valid transitions — not the client
function actionsForStatus(article: SavedArticle): SirenAction[] {
  const base = `/api/articles/${article.id}`;
  const actions: SirenAction[] = [];

  if (article.status !== "read") {
    actions.push({
      name: "mark-read",
      href: `${base}/status`,
      method: "PUT",
      type: "application/json",
      fields: [{ name: "status", type: "hidden", value: "read" }],
    });
  }
  if (article.status !== "unread") {
    actions.push({
      name: "mark-unread",
      href: `${base}/status`,
      method: "PUT",
      type: "application/json",
      fields: [{ name: "status", type: "hidden", value: "unread" }],
    });
  }
  if (article.status !== "archived") {
    actions.push({
      name: "archive",
      href: `${base}/status`,
      method: "PUT",
      type: "application/json",
      fields: [{ name: "status", type: "hidden", value: "archived" }],
    });
  }
  actions.push({ name: "delete", href: base, method: "DELETE" });

  return actions;
}
```

### 5.2 Updated `AppDependencies`

The `createApp` function in `server.ts` gains OAuth dependencies:

```typescript
interface AppDependencies {
  // existing...

  // OAuth (new)
  storeAuthorizationCode: StoreAuthorizationCode;
  exchangeAuthorizationCode: ExchangeAuthorizationCode;
  createTokenPair: CreateTokenPair;
  validateAccessToken: ValidateAccessToken;
  refreshAccessToken: RefreshAccessToken;
  revokeToken: RevokeToken;
}
```

### 5.3 Route Mounting

```typescript
// In createApp():
const oauthRouter = initOAuthRoutes({
  storeAuthorizationCode: deps.storeAuthorizationCode,
  exchangeAuthorizationCode: deps.exchangeAuthorizationCode,
  createTokenPair: deps.createTokenPair,
  refreshAccessToken: deps.refreshAccessToken,
  revokeToken: deps.revokeToken,
});
app.use("/oauth", oauthRouter);

const apiAuthMiddleware = initApiAuth({
  validateAccessToken: deps.validateAccessToken,
});

const apiRouter = initApiRoutes({
  findArticlesByUser: deps.findArticlesByUser,
  findArticleById: deps.findArticleById,
  saveArticle: deps.saveArticle,
  parseArticle: deps.parseArticle,
  deleteArticle: deps.deleteArticle,
  updateArticleStatus: deps.updateArticleStatus,
});
app.use("/api", apiAuthMiddleware, apiRouter);
```

Note: mounted at `/api` — no version segment.

### 5.4 Authentication Middleware

```typescript
function initApiAuth(deps: { validateAccessToken: ValidateAccessToken }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401)
        .set("WWW-Authenticate", "Bearer")
        .type("application/vnd.siren+json")
        .json({
          class: ["error"],
          properties: { code: "missing-token", message: "Bearer token required" },
        });
      return;
    }
    const token = header.slice(7) as AccessToken;
    const userId = await deps.validateAccessToken(token);
    if (!userId) {
      res.status(401)
        .set("WWW-Authenticate", "Bearer error=\"invalid_token\"")
        .type("application/vnd.siren+json")
        .json({
          class: ["error"],
          properties: { code: "invalid-token", message: "Token expired or invalid" },
        });
      return;
    }
    req.userId = userId;
    next();
  };
}
```

### 5.5 Updated `app.ts` Provider Wiring

```typescript
function initProviders() {
  if (getEnv("NODE_ENV") === "production") {
    // existing tables...
    const oauthCodesTable = requireEnv("DYNAMODB_OAUTH_CODES_TABLE");
    const oauthTokensTable = requireEnv("DYNAMODB_OAUTH_TOKENS_TABLE");

    return {
      ...initDynamoDbAuth({ client, usersTableName, sessionsTableName }),
      ...initDynamoDbArticleStore({ client, tableName: articlesTable }),
      ...initDynamoDbOAuth({ client, codesTableName: oauthCodesTable, tokensTableName: oauthTokensTable }),
    };
  }

  return {
    ...initInMemoryAuth(),
    ...initInMemoryArticleStore(),
    ...initInMemoryOAuth(),
  };
}
```

---

## 6. Infrastructure Changes (Pulumi)

### 6.1 New DynamoDB Tables

Add to `HutchStorage`:

```typescript
this.oauthCodesTable = new aws.dynamodb.Table("hutch-oauth-codes", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "code",
  attributes: [{ name: "code", type: "S" }],
  ttl: { attributeName: "expiresAt", enabled: true },
});

this.oauthTokensTable = new aws.dynamodb.Table("hutch-oauth-tokens", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "accessToken",
  attributes: [
    { name: "accessToken", type: "S" },
    { name: "refreshToken", type: "S" },
    { name: "userId", type: "S" },
  ],
  globalSecondaryIndexes: [
    {
      name: "refreshToken-index",
      hashKey: "refreshToken",
      projectionType: "ALL",
    },
    {
      name: "userId-index",
      hashKey: "userId",
      projectionType: "KEYS_ONLY",
    },
  ],
  ttl: { attributeName: "expiresAt", enabled: true },
});
```

### 6.2 Lambda IAM Policy Update

Add the new tables to the existing DynamoDB access policy resource list.

### 6.3 Lambda Environment Variables

Add:
```
DYNAMODB_OAUTH_CODES_TABLE: oauthCodesTable.name
DYNAMODB_OAUTH_TOKENS_TABLE: oauthTokensTable.name
```

---

## 7. File Structure (New Files)

Updated to use `@node-oauth/express-oauth-server` (see section 11.1):

```
src/runtime/
├── domain/
│   └── oauth/
│       └── oauth.types.ts                    # OAuthClientId, AccessToken, RefreshToken, AuthorizationCode
│
├── providers/
│   └── oauth/
│       ├── oauth-clients.ts                  # Static client registry
│       ├── oauth-model.ts                    # @node-oauth Model adapter (in-memory)
│       ├── oauth-model.test.ts               # Model adapter tests
│       ├── dynamodb-oauth-model.ts           # DynamoDB Model adapter
│       └── dynamodb-oauth-model.test.ts      # Integration tests
│
├── web/
│   ├── api/
│   │   ├── siren.ts                          # Generic Siren type definitions
│   │   ├── siren.test.ts                     # Siren helper tests
│   │   ├── article-siren.ts                  # SavedArticle → Siren entity mapper
│   │   ├── article-siren.test.ts             # Tests: status-dependent actions, properties
│   │   ├── collection-siren.ts               # FindArticlesResult → Siren collection mapper
│   │   ├── collection-siren.test.ts          # Tests: pagination links, embedded entities
│   │   ├── api.routes.ts                     # Hypermedia API Express router
│   │   ├── api.routes.test.ts                # Integration tests (supertest)
│   │   ├── api.schema.ts                     # Zod schemas for API input
│   │   └── api.middleware.ts                 # Bearer token auth (uses oauthServer.authenticate())
│   │
│   └── oauth/
│       ├── oauth.routes.ts                   # OAuth endpoints (wires ExpressOAuthServer)
│       ├── oauth.routes.test.ts              # Integration tests
│       ├── oauth-authorize.template.ts       # Authorization consent page
│       └── oauth-authorize.template.html     # HTML template
│
src/infra/
    └── index.ts                              # Updated: 2 new DynamoDB tables + IAM
```

**Note:** The library handles PKCE verification, token generation, and refresh token rotation internally. Custom `pkce.ts` and provider type definitions are no longer needed — only the Model adapter that connects to DynamoDB.

---

## 8. Testing Strategy

Following the project's test-driven design conventions.

### 8.1 Unit Tests

| What | File | Approach |
|------|------|----------|
| OAuth Model adapter | `oauth-model.test.ts` | Test Model interface methods (save/get/revoke) |
| OAuth domain types | Compile-time only (branded types) | — |
| Article → Siren mapping | `article-siren.test.ts` | Pure function: verify properties, status-dependent actions |
| Collection → Siren mapping | `collection-siren.test.ts` | Verify pagination links, embedded entities |

**Note:** PKCE verification and token generation are handled by `@node-oauth/oauth2-server` — no custom unit tests needed for these. Focus tests on the Model adapter (DynamoDB read/write) and Siren serialization.

### 8.2 Integration Tests (supertest)

| What | File | Approach |
|------|------|----------|
| API root discovery | `api.routes.test.ts` | GET /api returns Siren with correct links + actions |
| Article CRUD via hypermedia | `api.routes.test.ts` | Follow links from root, submit actions, verify Siren responses |
| Status-dependent actions | `api.routes.test.ts` | Verify actions change based on article status |
| Pagination links | `api.routes.test.ts` | Verify `next`/`prev` links appear/disappear correctly |
| Content-Type negotiation | `api.routes.test.ts` | Verify `application/vnd.siren+json` content type |
| API auth (401) | `api.routes.test.ts` | Verify Bearer token + Siren error responses |
| OAuth authorize flow | `oauth.routes.test.ts` | GET/POST authorize, verify redirect with code |
| OAuth token exchange | `oauth.routes.test.ts` | POST /oauth/token, verify JSON response |
| OAuth refresh flow | `oauth.routes.test.ts` | Exchange refresh_token for new access_token |
| OAuth revoke | `oauth.routes.test.ts` | POST /oauth/revoke, verify token is invalidated |

### 8.3 Test Pattern — Hypermedia-Aware

Tests should verify the **Siren contract** (links, actions, properties), not hardcoded URLs. This mirrors how the real client will use the API.

```typescript
// api.routes.test.ts — example structure
const app = createApp({
  ...initInMemoryAuth(),
  ...initInMemoryArticleStore(),
  ...initInMemoryOAuth(),
  ...initReadabilityParser({ fetchHtml: stubFetchHtml }),
});

test("GET /api returns 401 without token", async () => {
  const res = await request(app)
    .get("/api")
    .set("Accept", "application/vnd.siren+json");
  expect(res.status).toBe(401);
  expect(res.body.class).toContain("error");
  expect(res.body.properties.code).toBe("missing-token");
});

test("API root exposes articles link and save-article action", async () => {
  const res = await request(app)
    .get("/api")
    .set("Authorization", `Bearer ${token}`)
    .set("Accept", "application/vnd.siren+json");

  expect(res.status).toBe(200);
  expect(res.body.class).toContain("root");

  const articlesLink = res.body.links.find((l) =>
    l.rel.includes("articles")
  );
  expect(articlesLink).toBeDefined();

  const saveAction = res.body.actions.find((a) =>
    a.name === "save-article"
  );
  expect(saveAction).toBeDefined();
  expect(saveAction.method).toBe("POST");
  expect(saveAction.fields.some((f) => f.name === "url")).toBe(true);
});

test("unread article has mark-read action but not mark-unread", async () => {
  // 1. Save an article (status defaults to "unread")
  // 2. GET the article via its self link
  // 3. Verify mark-read action exists
  // 4. Verify mark-unread action does NOT exist
  // 5. Submit mark-read action
  // 6. Verify response now has mark-unread but not mark-read
});

test("collection includes pagination links", async () => {
  // 1. Save 25 articles (default pageSize = 20)
  // 2. GET /api/articles
  // 3. Verify "next" link exists
  // 4. Follow "next" link
  // 5. Verify "prev" link exists, "next" does not
});
```

### 8.4 Siren Serializer Unit Tests

The domain-to-Siren mappers are pure functions — tested in isolation without HTTP:

```typescript
// article-siren.test.ts
test("unread article entity includes mark-read and archive actions", () => {
  const article = makeArticle({ status: "unread" });
  const entity = toArticleEntity(article);

  const actionNames = entity.actions.map((a) => a.name);
  expect(actionNames).toContain("mark-read");
  expect(actionNames).toContain("archive");
  expect(actionNames).not.toContain("mark-unread");
});

test("article entity omits content in embedded (sub-entity) form", () => {
  const article = makeArticle({ content: "<p>Full text</p>" });
  const subEntity = toArticleSubEntity(article);

  expect(subEntity.properties.content).toBeUndefined();
});

test("article entity includes content in full form", () => {
  const article = makeArticle({ content: "<p>Full text</p>" });
  const entity = toArticleEntity(article);

  expect(entity.properties.content).toBe("<p>Full text</p>");
});
```

### 8.5 No E2E Tests for API

Per CLAUDE.md guidelines: use integration tests for filter/query functionality, not E2E tests. The API routes are stateless Siren handlers — supertest covers the full server-side flow without browser overhead.

---

## 9. CORS Configuration

Browser extensions make cross-origin requests to hutch-app.com. Add CORS headers for API routes only:

```typescript
// Applied only to /api and /oauth/token routes
const apiCors = cors({
  origin: (origin, callback) => {
    // Browser extensions use moz-extension:// (Firefox) or chrome-extension:// (Chrome/Chromium) origins
    if (!origin || /^(moz|chrome)-extension:\/\//.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 86400,
});
```

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token leakage | Access tokens are short-lived (1 hour). Refresh tokens are single-use (rotated on each refresh). |
| PKCE bypass | Authorization codes require valid `code_verifier`. S256 only (no plain). |
| CSRF on /oauth/authorize | `state` parameter verified by extension. Authorization page requires active hutch-app session. |
| Extension impersonation | `redirect_uri` must exactly match registered URIs. `client_id` is validated. |
| Token storage in extension | Extension stores tokens in `browser.storage.local` (encrypted by Firefox). |
| Brute force on tokens | Tokens are 32-byte random hex (256 bits of entropy). |
| Replay attacks | Authorization codes are single-use, deleted after exchange. |
| Scope escalation | No scopes initially — tokens grant full access to the authenticated user's data only. Scopes can be added later as new Siren actions without breaking existing clients. |

---

## 11. Recommended Libraries

This section recommends off-the-shelf libraries to simplify implementation. Both are popular, actively maintained, and well-tested.

### 11.1 OAuth 2.0: @node-oauth/express-oauth-server

**Package:** [`@node-oauth/express-oauth-server`](https://github.com/node-oauth/express-oauth-server) (wraps `@node-oauth/oauth2-server`)

**Why use it:**
- RFC 6749 compliant, including Authorization Code + PKCE (RFC 7636)
- Built-in token generation, validation, and refresh
- Express middleware integration
- Actively maintained (last update: January 2026)
- Handles edge cases (token expiration, code replay, PKCE verification)

**What it replaces:**
- Custom PKCE verification logic (`pkce.ts`)
- Token generation/validation (`CreateTokenPair`, `ValidateAccessToken`)
- Authorization code exchange (`ExchangeAuthorizationCode`)
- Refresh token rotation (`RefreshAccessToken`)

**What you still implement:**
- A "model" adapter that connects the library to DynamoDB
- The authorization consent page (HTML)
- Static client registry

**Installation:**
```bash
pnpm add @node-oauth/express-oauth-server
```

**Integration pattern:**

Instead of implementing `dynamodb-oauth.ts` with custom token logic, implement a model adapter:

```typescript
// oauth-model.ts — Adapter between @node-oauth and DynamoDB
import OAuth2Server from "@node-oauth/oauth2-server";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

interface ModelDeps {
  client: DynamoDBDocumentClient;
  codesTableName: string;
  tokensTableName: string;
}

export function initOAuthModel(deps: ModelDeps): OAuth2Server.Model {
  return {
    // Required for authorization_code grant
    async getClient(clientId: string, _clientSecret: string) {
      return REGISTERED_CLIENTS[clientId] || null;
    },

    async saveAuthorizationCode(code, client, user) {
      // Store in hutch-oauth-codes DynamoDB table
      await deps.client.send(new PutCommand({
        TableName: deps.codesTableName,
        Item: {
          code: code.authorizationCode,
          clientId: client.id,
          userId: user.id,
          redirectUri: code.redirectUri,
          codeChallenge: code.codeChallenge,
          codeChallengeMethod: code.codeChallengeMethod,
          expiresAt: Math.floor(code.expiresAt.getTime() / 1000),
        },
      }));
      return { ...code, client, user };
    },

    async getAuthorizationCode(authorizationCode: string) {
      // Retrieve from DynamoDB, return null if expired
    },

    async revokeAuthorizationCode(code) {
      // Delete from DynamoDB (single-use)
      return true;
    },

    async saveToken(token, client, user) {
      // Store in hutch-oauth-tokens DynamoDB table
    },

    async getAccessToken(accessToken: string) {
      // Retrieve from DynamoDB, return null if expired
    },

    async getRefreshToken(refreshToken: string) {
      // Query GSI by refreshToken
    },

    async revokeToken(token) {
      // Delete from DynamoDB (single-use refresh tokens)
      return true;
    },

    // PKCE support (built into the library)
    verifyScope: async () => true, // No scopes initially
  };
}
```

**Route setup:**

```typescript
import OAuth2Server from "@node-oauth/oauth2-server";
import ExpressOAuthServer from "@node-oauth/express-oauth-server";

const oauthServer = new ExpressOAuthServer({
  model: initOAuthModel({ client, codesTableName, tokensTableName }),
  allowExtendedTokenAttributes: true,
});

// Token endpoint — library handles PKCE verification, token generation
app.post("/oauth/token", oauthServer.token());

// Authorization endpoint — custom HTML page, then library generates code
app.post("/oauth/authorize", oauthServer.authorize());
```

**Simplification summary:**
- ~200 lines of custom PKCE/token logic → ~50 lines of model adapter
- Library handles token entropy, expiration, PKCE S256 verification
- Focus on DynamoDB storage, not OAuth protocol details

### 11.2 Siren: Custom Types (Recommended)

**Assessment:** The Siren ecosystem has limited library support. The most relevant package is [`siren-types`](https://github.com/xogeny/siren-types) (TypeScript definitions), but it was last updated in 2022.

**Recommendation:** Keep the custom types defined in section 5.1 (`siren.ts`).

**Rationale:**
1. Siren is a simple format (~6 interfaces)
2. The domain-to-Siren mapping (`article-siren.ts`) is inherently custom
3. Custom types allow exact control over optional properties and naming
4. No runtime dependency for a 50-line type definition file

**Optional:** If you prefer a library, `siren-types` provides similar type definitions:

```bash
pnpm add siren-types
```

```typescript
import type { Entity, Action, Link } from "siren-types";
```

However, the custom approach in section 5.1 is cleaner for this codebase since it integrates directly with the domain-to-wire mapping layer.

---

## 12. Implementation Order

Suggested phased approach (updated to use `@node-oauth/express-oauth-server`):

### Phase 1: Siren Serialization Layer (Test-First)
1. `web/api/siren.ts` — Generic Siren type definitions
2. `web/api/article-siren.ts` + tests — SavedArticle → Siren entity mapper with status-dependent actions
3. `web/api/collection-siren.ts` + tests — FindArticlesResult → Siren collection with pagination links

### Phase 2: OAuth Model Adapter
4. Install `@node-oauth/express-oauth-server`
5. `domain/oauth/oauth.types.ts` — branded types
6. `providers/oauth/oauth-clients.ts` — static client registry
7. `providers/oauth/oauth-model.ts` + tests — Model adapter interface (in-memory for dev/test)

### Phase 3: OAuth Endpoints (Library-Based)
8. `web/oauth/oauth.routes.ts` + tests — Wire up `ExpressOAuthServer` middleware
9. `web/oauth/oauth-authorize.template.ts` + HTML — consent page
10. Update `server.ts` — mount OAuth routes

### Phase 4: Hypermedia API Routes
11. `web/api/api.middleware.ts` — Bearer token middleware (uses `oauthServer.authenticate()`)
12. `web/api/api.schema.ts` — Zod schemas for API input
13. `web/api/api.routes.ts` + tests — root, collection, single entity, actions
14. Update `server.ts` — mount `/api` routes with auth middleware
15. CORS configuration

### Phase 5: DynamoDB + Infrastructure
16. `providers/oauth/dynamodb-oauth-model.ts` + tests — DynamoDB model adapter
17. Update `infra/index.ts` — new tables, IAM, env vars
18. Update `app.ts` — wire DynamoDB OAuth model in production

### Phase 6: Integration & Hardening
19. End-to-end manual test of full OAuth + hypermedia flow with Firefox extension
20. Token rotation, revocation edge cases
21. Rate limiting on `/oauth/token` (future consideration)
