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

- ✅ `middleware/sessionAuth.ts` — implemented
- ✅ `server.ts` — implemented
- ✅ `requests.http` — ready
- ✅ `README.md` — written

**Concepts covered:**

- express-session configuration (secret, resave, saveUninitialized)
- Cookie flags: HttpOnly, Secure, SameSite, maxAge
- Server-side session store (MemoryStore vs Redis)
- Session vs cookie distinction
- Session fixation — req.session.regenerate() on login
- Timing-safe login (always run bcrypt even on unknown username)
- Why logout is now possible (vs Basic Auth)
- 401 vs 403 distinction

---

## Module 03 — Token Auth (port 3003)
- ✅ `middleware/tokenAuth.ts` — implemented
- ✅ `server.ts` — implemented
- ✅ `requests.http` — ready

**Concepts covered:**
- Bearer token scheme (Authorization: Bearer <token>)
- Opaque tokens: random UUID, no embedded meaning
- Server-side token store (user.tokens[])
- Token lookup on every request — O(n) scan / DB index in prod
- Real logout via token deletion
- Multiple tokens per user (multi-device)
- Constant-time login (bcrypt always runs)

---

## Module 04 — JWT Auth (port 3004)
- ✅ `middleware/jwtAuth.ts` — implemented
- ✅ `server.ts` — implemented
- ✅ `requests.http` — ready

**Concepts covered:**
- JWT structure: header.payload.signature (base64url, not encrypted)
- HS256 symmetric signing — same secret signs and verifies
- Standard claims: sub, iat, exp
- Custom claims: username, role (embedded at login, verified cryptographically)
- Access token (15m, stateless) vs refresh token (7d, stored server-side)
- No DB lookup on every request — purely cryptographic verification
- The revocation problem: access tokens valid until expiry even after logout
- Refresh flow: /refresh does one DB lookup to get fresh user claims
- Algorithm confusion attack — always pin the algorithm in jwt.verify()

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
