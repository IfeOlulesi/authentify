# Tutorial Progress

## Status Legend
- ✅ Complete
- 🔨 In progress
- ⏳ Not started

---

## Shared Layer
- ✅ `shared/types.ts` — User, Book, AuthenticatedUser interfaces
- ✅ `shared/data/books.ts` — mock books + CRUD helpers
- ✅ `shared/data/users.ts` — mock users, findUserByUsername, findUserById, verifyPassword

---

## Module 01 — Basic Authentication (port 3001)
- ✅ `middleware/basicAuth.ts` — basicAuth + requireRole
- ✅ `server.ts` — all routes wired up
- ✅ `requests.http` — test requests (hardcoded base64 creds)

**Concepts covered:**
- Authorization: Basic header structure
- base64 encoding (not encryption)
- bcrypt constant-time comparison
- 401 vs 403 distinction
- Middleware factory pattern (requireRole)
- WWW-Authenticate response header

---

## Module 02 — Session Auth (port 3002)
- ✅ `middleware/sessionAuth.ts` — scaffolded
- ✅ `server.ts` — scaffolded (/login, /logout, /me + book routes)
- ✅ `requests.http` — scaffolded

**To implement:**
- `requireSession` middleware
- `requireRole` middleware
- POST /login — create session, set cookie
- POST /logout — destroy session
- Book route handlers

**Key concepts to understand:**
- express-session configuration (secret, resave, saveUninitialized)
- Cookie flags: HttpOnly, Secure, SameSite, maxAge
- Server-side session store (MemoryStore vs Redis)
- Session vs cookie distinction
- Why logout is now possible (vs Basic Auth)

---

## Module 03 — Token Auth (port 3003)
- ✅ `middleware/tokenAuth.ts` — scaffolded
- ✅ `server.ts` — scaffolded
- ✅ `requests.http` — scaffolded

**To implement:**
- `tokenAuth` middleware — Bearer token lookup
- `requireRole`
- POST /login — generate UUID token, store on user
- POST /logout — remove token from store
- Book route handlers

**Key concepts to understand:**
- Bearer token scheme (Authorization: Bearer <token>)
- Opaque tokens vs self-describing tokens (sets up JWT)
- Server-side token invalidation
- Why a DB lookup is still required on every request

---

## Module 04 — JWT Auth (port 3004)
- ✅ `middleware/jwtAuth.ts` — scaffolded
- ✅ `server.ts` — scaffolded
- ✅ `requests.http` — scaffolded

**To implement:**
- `generateTokens` — jwt.sign() access + refresh tokens
- `jwtAuth` middleware — jwt.verify(), no DB lookup
- `requireRole`
- POST /login, /refresh, /logout
- Book route handlers

**Key concepts to understand:**
- JWT structure: header.payload.signature
- HS256 vs RS256 signing algorithms
- Claims: sub, iat, exp, custom claims
- Access token (short-lived) vs refresh token (long-lived)
- The token revocation problem — why you can't invalidate an access token
- Refresh token rotation pattern

---

## Module 05 — OAuth (ports 3050, 3051)
- ⏳ Not scaffolded yet

**Plan:**
- Phase A: Mock IdP (Authorization Server) + Client App — see every redirect
- Phase B: Swap mock IdP for GitHub OAuth

---

## Module 06 — SSO (ports 3060, 3061, 3062)
- ⏳ Not scaffolded yet

**Plan:**
- Reuse OAuth IdP from module 05 as the identity provider
- Two separate "service provider" Express apps that trust it

---

## Where to Pick Up Next

**Currently:** Module 02 — Session Auth implementation

Start with `02-session-auth/middleware/sessionAuth.ts`:
1. Implement `requireSession`
2. Implement `requireRole`
3. Then move to `server.ts` — implement /login first (most interesting part)
