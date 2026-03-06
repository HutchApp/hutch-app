# API Input/Output Interfaces

This document describes the input/output interfaces for the Siren hypermedia API and OAuth 2.0 integration.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Firefox Extension                                  │
│                         (hutch-firefox-extension)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                     │
│                  (hutch-app.com / extensions.hutch-app.com)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Express App                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          CORS Middleware                                 ││
│  │            Allows: moz-extension://, chrome-extension://                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐               │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│  ┌────────────────┐    ┌─────────────────────┐    ┌───────────────────┐    │
│  │  /oauth/*      │    │      /queue/*       │    │   Web Pages       │    │
│  │  OAuth Routes  │    │  (Content Negot.)   │    │ (/, /login, etc)  │    │
│  └────────────────┘    └─────────────────────┘    └───────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Content Negotiation

The `/queue` routes support both HTML (for browsers) and Siren (for the Firefox extension) via HTTP content negotiation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Content Negotiation                                  │
│                                                                              │
│  Accept: text/html (or default)                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  • Authentication: Session cookie                                       ││
│  │  • Response: text/html                                                  ││
│  │  • Used by: Browser clients                                             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Accept: application/vnd.siren+json                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  • Authentication: Bearer token (OAuth 2.0)                             ││
│  │  • Response: application/vnd.siren+json                                 ││
│  │  • Used by: Firefox extension                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## OAuth 2.0 Flow

```
┌──────────────┐                                           ┌─────────────────┐
│   Extension  │                                           │   Hutch Server  │
└──────────────┘                                           └─────────────────┘
       │                                                           │
       │  1. GET /oauth/authorize                                  │
       │     ┌─────────────────────────────────────────┐          │
       │     │ client_id: hutch-firefox-extension      │          │
       │     │ redirect_uri: http://localhost:3000/cb  │          │
       │     │ response_type: code                     │          │
       │     │ code_challenge: <PKCE S256 hash>        │          │
       │     │ code_challenge_method: S256             │          │
       │     │ state: <random>                         │          │
       │     └─────────────────────────────────────────┘          │
       │─────────────────────────────────────────────────────────▶│
       │                                                           │
       │  2. Show authorization form (if logged in)                │
       │◀─────────────────────────────────────────────────────────│
       │     ┌─────────────────────────────────────────┐          │
       │     │ HTML: "Authorize Hutch Firefox Extension│          │
       │     │        to access your account?"         │          │
       │     └─────────────────────────────────────────┘          │
       │                                                           │
       │  3. POST /oauth/authorize (action: approve)              │
       │─────────────────────────────────────────────────────────▶│
       │                                                           │
       │  4. 302 Redirect with authorization code                  │
       │◀─────────────────────────────────────────────────────────│
       │     ┌─────────────────────────────────────────┐          │
       │     │ Location: redirect_uri?code=<auth_code> │          │
       │     │           &state=<original_state>       │          │
       │     └─────────────────────────────────────────┘          │
       │                                                           │
       │  5. POST /oauth/token                                     │
       │     ┌─────────────────────────────────────────┐          │
       │     │ grant_type: authorization_code          │          │
       │     │ code: <auth_code>                       │          │
       │     │ redirect_uri: <same as above>           │          │
       │     │ client_id: hutch-firefox-extension      │          │
       │     │ code_verifier: <PKCE plaintext>         │          │
       │     └─────────────────────────────────────────┘          │
       │─────────────────────────────────────────────────────────▶│
       │                                                           │
       │  6. Token response                                        │
       │◀─────────────────────────────────────────────────────────│
       │     ┌─────────────────────────────────────────┐          │
       │     │ {                                       │          │
       │     │   "access_token": "<64-char hex>",      │          │
       │     │   "token_type": "Bearer",               │          │
       │     │   "expires_in": 3600,                   │          │
       │     │   "refresh_token": "<64-char hex>"      │          │
       │     │ }                                       │          │
       │     └─────────────────────────────────────────┘          │
       │                                                           │
```

## Siren API Endpoints

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /queue (Entry Point)                            │
│                                                                              │
│  Request:  GET /queue                                                       │
│            Accept: application/vnd.siren+json                               │
│            Authorization: Bearer <access_token>                             │
│                                                                              │
│  Response: application/vnd.siren+json                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                      │ │
│  │   "class": ["collection", "articles"],                                │ │
│  │   "properties": { "total": 10, "page": 1, "pageSize": 20 },          │ │
│  │   "links": [                                                           │ │
│  │     { "rel": ["self"], "href": "/queue" },                            │ │
│  │     { "rel": ["root"], "href": "/queue" }                             │ │
│  │   ]                                                                    │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
            ┌──────────────────┐         ┌──────────────────┐
            │   GET /queue/:id │         │  POST /queue     │
            │   (Full Article) │         │  (Save Article)  │
            └──────────────────┘         └──────────────────┘
```

## Article Collection Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             GET /queue                                       │
│                                                                              │
│  Request:                                                                    │
│    Accept: application/vnd.siren+json                                       │
│    Authorization: Bearer <access_token>                                     │
│    Query params: ?status=unread|read|archived&page=1                        │
│                                                                              │
│  Response: application/vnd.siren+json                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                      │ │
│  │   "class": ["collection", "articles"],                                 │ │
│  │   "properties": { "total": 10, "page": 1, "pageSize": 20 },           │ │
│  │   "entities": [                                                        │ │
│  │     {                                                                  │ │
│  │       "class": ["article"],                                            │ │
│  │       "rel": ["item"],                                                 │ │
│  │       "properties": {                                                  │ │
│  │         "id": "article-123",                                           │ │
│  │         "title": "Article Title",                                      │ │
│  │         "url": "https://example.com/article",                          │ │
│  │         "status": "unread",                                            │ │
│  │         "savedAt": "2026-03-05T12:00:00Z",                             │ │
│  │         "estimatedReadTimeMinutes": 5                                  │ │
│  │         // Note: "content" is OMITTED in collection (bandwidth saving) │ │
│  │       },                                                               │ │
│  │       "links": [{ "rel": ["self"], "href": "/queue/123" }]            │ │
│  │     }                                                                  │ │
│  │   ],                                                                   │ │
│  │   "links": [                                                           │ │
│  │     { "rel": ["self"], "href": "/queue" },                            │ │
│  │     { "rel": ["next"], "href": "/queue?page=2" }                      │ │
│  │   ],                                                                   │ │
│  │   "actions": [{                                                        │ │
│  │     "name": "save-article",                                            │ │
│  │     "method": "POST",                                                  │ │
│  │     "href": "/queue",                                                  │ │
│  │     "type": "application/json",                                        │ │
│  │     "fields": [{ "name": "url", "type": "url" }]                      │ │
│  │   }]                                                                   │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Single Article Interface (State-Dependent Actions)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GET /queue/:id                                      │
│                                                                              │
│  Response varies based on article status:                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ UNREAD Article                                                          ││
│  │ actions: [mark-read, archive, delete]                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ READ Article                                                            ││
│  │ actions: [mark-unread, archive, delete]                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ARCHIVED Article                                                        ││
│  │ actions: [mark-unread, mark-read, delete]                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Example Response (unread):                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                      │ │
│  │   "class": ["article"],                                                │ │
│  │   "properties": {                                                      │ │
│  │     "id": "article-123",                                               │ │
│  │     "title": "Article Title",                                          │ │
│  │     "content": "<html>...</html>",  // Full content included           │ │
│  │     "status": "unread",                                                │ │
│  │     ...                                                                │ │
│  │   },                                                                   │ │
│  │   "actions": [                                                         │ │
│  │     {                                                                  │ │
│  │       "name": "mark-read",                                             │ │
│  │       "method": "PUT",                                                 │ │
│  │       "href": "/queue/123/status",                                     │ │
│  │       "type": "application/json",                                      │ │
│  │       "fields": [{ "name": "status", "value": "read" }]               │ │
│  │     },                                                                 │ │
│  │     { "name": "archive", ... },                                        │ │
│  │     { "name": "delete", "method": "DELETE", ... }                     │ │
│  │   ]                                                                    │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## OAuth Model Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OAuthModelDeps                                     │
│                                                                              │
│  In-Memory Storage (current implementation):                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  codes: Map<string, StoredAuthorizationCode>                          │ │
│  │    └── authCode -> { code, clientId, userId, redirectUri,             │ │
│  │                      codeChallenge, codeChallengeMethod, expiresAt }  │ │
│  │                                                                        │ │
│  │  tokens: Map<string, StoredToken>                                      │ │
│  │    └── accessToken -> { accessToken, refreshToken, clientId, userId,  │ │
│  │                         accessTokenExpiresAt, refreshTokenExpiresAt } │ │
│  │                                                                        │ │
│  │  refreshTokenIndex: Map<string, string>                                │ │
│  │    └── refreshToken -> accessToken                                     │ │
│  │                                                                        │ │
│  │  userIdIndex: Map<string, Set<string>>                                 │ │
│  │    └── userId -> Set<accessTokens>  (for bulk revocation)             │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Future DynamoDB Storage:                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  hutch-oauth-codes table                                               │ │
│  │    PK: code                                                            │ │
│  │    TTL: expiresAt                                                      │ │
│  │                                                                        │ │
│  │  hutch-oauth-tokens table                                              │ │
│  │    PK: accessToken                                                     │ │
│  │    GSI: refreshToken-index (for token refresh)                         │ │
│  │    GSI: userId-index (for bulk revocation)                             │ │
│  │    TTL: refreshTokenExpiresAt                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Registered OAuth Clients

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         oauth-clients.ts                                     │
│                                                                              │
│  REGISTERED_CLIENTS: {                                                      │
│    "hutch-firefox-extension": {                                             │
│      id: "hutch-firefox-extension"                                          │
│      name: "Hutch Firefox Extension"                                        │
│      redirectUris: [                                                        │
│        "https://extensions.hutch-app.com/callback",  // Production          │
│        "http://localhost:3000/callback"              // Development         │
│      ]                                                                      │
│      grants: ["authorization_code", "refresh_token"]                        │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Infrastructure Domain Registration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          infra/index.ts                                      │
│                                                                              │
│  DomainRegistration("hutch-domain", {                                       │
│    domains: [                                                               │
│      "hutch-app.com",              // Primary domain (web app)              │
│      "extensions.hutch-app.com"    // Extension OAuth callbacks             │
│    ]                                                                        │
│  })                                                                         │
│                                                                              │
│  Route53 Records:                                                           │
│    hutch-app.com            -> API Gateway                                  │
│    extensions.hutch-app.com -> API Gateway                                  │
│                                                                              │
│  ACM Certificate:                                                           │
│    Primary: hutch-app.com                                                   │
│    SAN: extensions.hutch-app.com                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```
