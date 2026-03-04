# Hutch API Plan — Firefox Extension Integration

## Goal

Expose a JSON API from the hutch-app web application so the Firefox extension (and any future client) can read/write the same DynamoDB data as the website. Authentication uses a self-hosted OAuth 2.0 Authorization Code + PKCE flow — no third-party OAuth providers.

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

---

## 4. JSON API Endpoints

All API routes live under `/api/v1` and return JSON. They reuse the **same domain functions** injected into the web routes.

```
src/runtime/web/api/api.routes.ts     — Express router
src/runtime/web/api/api.schema.ts     — Zod request schemas
src/runtime/web/api/api.middleware.ts  — Bearer token auth middleware
```

### 4.1 Authentication Middleware

```typescript
// Extracts Bearer token from Authorization header, validates via ValidateAccessToken
function initApiAuth(deps: { validateAccessToken: ValidateAccessToken }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing-token" });
      return;
    }
    const token = header.slice(7) as AccessToken;
    const userId = await deps.validateAccessToken(token);
    if (!userId) {
      res.status(401).json({ error: "invalid-token" });
      return;
    }
    req.userId = userId;
    next();
  };
}
```

### 4.2 API Routes

| Method | Path | Description | Request body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/api/v1/articles` | List user's saved articles | — | `{ articles, total, page, pageSize }` |
| `GET` | `/api/v1/articles/:id` | Get single article | — | `{ article }` or `404` |
| `POST` | `/api/v1/articles` | Save a new article (URL) | `{ url }` | `{ article }` (201) |
| `PATCH` | `/api/v1/articles/:id/status` | Update article status | `{ status }` | `{ ok: true }` or `404` |
| `DELETE` | `/api/v1/articles/:id` | Delete article | — | `204` or `404` |
| `GET` | `/api/v1/me` | Current user info | — | `{ userId }` |

Query parameters for `GET /api/v1/articles`:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `"unread" \| "read" \| "archived"` | all | Filter by status |
| `order` | `"asc" \| "desc"` | `"desc"` | Sort order by savedAt |
| `page` | number | `1` | Page number |
| `pageSize` | number | `20` | Items per page (max 100) |

### 4.3 OAuth Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/oauth/authorize` | Show authorization page (login + consent) |
| `POST` | `/oauth/authorize` | Submit authorization (user approves) |
| `POST` | `/oauth/token` | Exchange code for tokens / refresh tokens |
| `POST` | `/oauth/revoke` | Revoke an access token |

### 4.4 Error Response Format

All API errors follow a consistent shape:

```json
{
  "error": "error-code-slug",
  "message": "Human-readable description"
}
```

HTTP status codes:
- `400` — Validation error, bad request
- `401` — Missing or invalid token
- `403` — Token valid but not authorized for this resource
- `404` — Resource not found (or not owned by user)
- `422` — Validation passed but operation failed (e.g., URL could not be parsed)

### 4.5 Article JSON Representation

The API returns articles in a flat JSON shape (same as the export format):

```json
{
  "id": "abc123...",
  "url": "https://example.com/article",
  "title": "Article Title",
  "siteName": "Example",
  "excerpt": "First paragraph...",
  "wordCount": 1200,
  "estimatedReadTimeMinutes": 5,
  "status": "unread",
  "savedAt": "2026-03-04T10:00:00.000Z",
  "readAt": null
}
```

Note: `content` is intentionally omitted from list responses (bandwidth). It is included in `GET /api/v1/articles/:id`.

---

## 5. Server Integration

### 5.1 Updated `AppDependencies`

The `createApp` function in `server.ts` gains new OAuth dependencies:

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

### 5.2 Route Mounting

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
app.use("/api/v1", apiAuthMiddleware, apiRouter);
```

### 5.3 Updated `app.ts` Provider Wiring

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

```
src/runtime/
├── domain/
│   └── oauth/
│       └── oauth.types.ts                    # OAuthClientId, AccessToken, RefreshToken, AuthorizationCode
│
├── providers/
│   └── oauth/
│       ├── oauth.types.ts                    # Provider function types
│       ├── oauth-clients.ts                  # Static client registry
│       ├── pkce.ts                           # PKCE challenge/verify helpers
│       ├── pkce.test.ts                      # Unit tests for PKCE
│       ├── dynamodb-oauth.ts                 # DynamoDB implementation
│       ├── dynamodb-oauth.test.ts            # Integration tests
│       ├── in-memory-oauth.ts                # In-memory for dev/testing
│       └── in-memory-oauth.test.ts           # Tests
│
├── web/
│   ├── api/
│   │   ├── api.routes.ts                     # JSON API Express router
│   │   ├── api.routes.test.ts                # Integration tests (supertest)
│   │   ├── api.schema.ts                     # Zod schemas for API input
│   │   └── api.middleware.ts                 # Bearer token auth middleware
│   │
│   └── oauth/
│       ├── oauth.routes.ts                   # OAuth authorize/token endpoints
│       ├── oauth.routes.test.ts              # Integration tests
│       ├── oauth.schema.ts                   # Zod schemas for OAuth params
│       ├── oauth-authorize.template.ts       # Authorization consent page
│       └── oauth-authorize.template.html     # HTML template
│
src/infra/
    └── index.ts                              # Updated: 2 new DynamoDB tables + IAM
```

---

## 8. Testing Strategy

Following the project's test-driven design conventions.

### 8.1 Unit Tests

| What | File | Approach |
|------|------|----------|
| PKCE S256 challenge/verify | `pkce.test.ts` | Pure function, no deps |
| OAuth domain types | Compile-time only (branded types) | — |
| Token generation | `in-memory-oauth.test.ts` | Test provider interface contract |

### 8.2 Integration Tests (supertest + parseHTML)

| What | File | Approach |
|------|------|----------|
| API article CRUD | `api.routes.test.ts` | `createApp()` with in-memory providers, supertest, JSON assertions |
| API auth (401/403) | `api.routes.test.ts` | Verify Bearer token validation |
| OAuth authorize flow | `oauth.routes.test.ts` | GET/POST authorize, verify redirect with code |
| OAuth token exchange | `oauth.routes.test.ts` | POST /oauth/token, verify JSON response |
| OAuth refresh flow | `oauth.routes.test.ts` | Exchange refresh_token for new access_token |
| OAuth revoke | `oauth.routes.test.ts` | POST /oauth/revoke, verify token is invalidated |

### 8.3 Test Pattern

```typescript
// api.routes.test.ts — example structure
const app = createApp({
  ...initInMemoryAuth(),
  ...initInMemoryArticleStore(),
  ...initInMemoryOAuth(),
  ...initReadabilityParser({ fetchHtml: stubFetchHtml }),
});

test("GET /api/v1/articles returns 401 without token", async () => {
  const res = await request(app).get("/api/v1/articles");
  expect(res.status).toBe(401);
  expect(res.body.error).toBe("missing-token");
});

test("GET /api/v1/articles returns user articles", async () => {
  // 1. Create user and get tokens via in-memory OAuth
  // 2. Save an article
  // 3. GET /api/v1/articles with Bearer token
  // 4. Assert JSON response matches saved article
});
```

### 8.4 No E2E Tests for API

Per CLAUDE.md guidelines: use integration tests for filter/query functionality, not E2E tests. The API routes are stateless JSON handlers — supertest covers the full server-side flow without browser overhead.

---

## 9. CORS Configuration

The Firefox extension makes cross-origin requests to hutch-app.com. Add CORS headers for API routes only:

```typescript
// Applied only to /api/v1 and /oauth/token routes
const apiCors = cors({
  origin: (origin, callback) => {
    // Browser extensions use moz-extension:// origin
    if (!origin || origin.startsWith("moz-extension://")) {
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
| Scope escalation | No scopes in v1 — tokens grant full access to the authenticated user's data only. |

---

## 11. Implementation Order

Suggested phased approach:

### Phase 1: OAuth Provider + Token Infrastructure
1. `domain/oauth/oauth.types.ts` — branded types
2. `providers/oauth/pkce.ts` + tests — PKCE helpers
3. `providers/oauth/oauth.types.ts` — provider interface
4. `providers/oauth/in-memory-oauth.ts` + tests
5. `providers/oauth/oauth-clients.ts` — static client registry

### Phase 2: OAuth Endpoints
6. `web/oauth/oauth.schema.ts` — Zod validation
7. `web/oauth/oauth.routes.ts` + tests — authorize + token endpoints
8. `web/oauth/oauth-authorize.template.ts` + HTML — consent page
9. Update `server.ts` — mount OAuth routes

### Phase 3: JSON API
10. `web/api/api.middleware.ts` — Bearer token middleware
11. `web/api/api.schema.ts` — Zod schemas for API input
12. `web/api/api.routes.ts` + tests — all CRUD endpoints
13. Update `server.ts` — mount API routes with auth middleware
14. CORS configuration

### Phase 4: DynamoDB + Infrastructure
15. `providers/oauth/dynamodb-oauth.ts` + tests
16. Update `infra/index.ts` — new tables, IAM, env vars
17. Update `app.ts` — wire DynamoDB OAuth provider in production

### Phase 5: Integration & Hardening
18. End-to-end manual test of full OAuth flow with Firefox extension
19. Token rotation, revocation edge cases
20. Rate limiting on `/oauth/token` (future consideration)
