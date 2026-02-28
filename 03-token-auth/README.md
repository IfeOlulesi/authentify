# Module 03 — Token-Based Authentication (Opaque Tokens)

## What is it?

A stateful, client-stored token scheme. At login the server generates a random token (UUID), stores it server-side, and returns it to the client in the response body. The client stores it and sends it in the `Authorization` header as a **Bearer token** on every subsequent request.

This is the bridge between session auth (cookie-based, server-managed) and JWT auth (cryptographic, stateless).

---

## How it works (plain English)

The server generates a random, meaningless token (a UUID v4). "Opaque" means the token itself carries **no information** — it's just a lookup key. The server still has to check its token store on every request to find out who the token belongs to.

```
Authorization: Bearer 9a7f3b2e-1c4d-4e8f-a0b2-3d5e7f9a1c3b
                       ^--- just a random UUID, means nothing on its own
```

The key differences from session auth:
- No cookie — the token is returned in the response body and the **client decides where to store it**
- No automatic browser behaviour — the client must manually attach the `Authorization` header
- Logout is real: deleting the token server-side makes it immediately worthless

---

## The HTTP Flow

```
Client                                          Server
  |                                                |
  |  POST /login                                   |
  |  { username: "alice", password: "..." }       |
  |----------------------------------------------->|
  |                                                |  1. Verify password
  |  200 OK                                        |  2. Generate UUID token
  |  { "token": "9a7f3b2e-..." }                  |  3. Store token on user record
  |<-----------------------------------------------|
  |                                                |
  |  GET /books                                    |
  |  Authorization: Bearer 9a7f3b2e-...           |
  |----------------------------------------------->|
  |                                                |  Look up which user owns this token
  |  200 OK                                        |  (DB/memory scan required)
  |  [ ...books ]                                  |
  |<-----------------------------------------------|
  |                                                |
  |  POST /logout                                  |
  |  Authorization: Bearer 9a7f3b2e-...           |
  |----------------------------------------------->|
  |                                                |  Remove token from store
  |  200 OK                                        |  Token is now worthless
  |<-----------------------------------------------|
```

---

## Opaque vs Self-Describing tokens

This is the central concept of module 03, and the problem JWT (module 04) solves.

| Property | Opaque Token (this module) | JWT (module 04) |
|---|---|---|
| Contains user data? | No — just a random string | Yes — encoded in the payload |
| Server lookup required? | Yes — every request | No — verify signature locally |
| Can be invalidated? | Yes — delete from store | No — valid until expiry |
| Inspectable by client? | No (meaningless) | Yes — base64 decode payload |

With an opaque token, the server is doing this on every request:

```
users.find(u => u.tokens.includes(token))
```

That's a linear scan. In production it would be a DB index lookup, but the round-trip still exists.

---

## Where does the client store the token?

Unlike session cookies, the client must choose where to keep the token. Each option has trade-offs:

| Storage | XSS Risk | CSRF Risk | Notes |
|---|---|---|---|
| `localStorage` | High — JS can read it | None — not auto-sent | Common but discouraged for sensitive tokens |
| `sessionStorage` | High | None | Lost when tab closes |
| In-memory (JS variable) | Low | None | Lost on page refresh |
| `HttpOnly` cookie | None | Yes | Now you're basically doing session auth again |

There's no perfect answer — each project makes a deliberate trade-off.

---

## Weaknesses

| Weakness | Explanation |
|---|---|
| Server-side state still required | Token store must be maintained; still a scaling concern |
| DB lookup on every request | The performance bottleneck JWT aims to fix |
| Token leakage | A stolen token gives full access until explicitly logged out |
| No expiry by default | Opaque tokens don't carry an expiry — you must implement it yourself |
| Client storage risks | Developer must choose where to store the token (see table above) |

---

## When is it actually used in production?

1. **API keys** — long-lived opaque tokens for server-to-server auth (GitHub tokens, Stripe keys)
2. **Password reset / email verification links** — single-use tokens stored in DB
3. **Internal tooling** where simplicity matters more than scale
4. **Rare for user-facing auth** in modern apps — JWTs or sessions are more common

---

## Run it

```bash
npm run 03:token-auth
```

## Test it with curl

```bash
# 1. Login — server returns a token in the response body
TOKEN=$(curl -s -X POST http://localhost:3003/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | jq -r '.token')

echo "Got token: $TOKEN"

# 2. Access protected route using the Bearer token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/books

# 3. Try without a token -> 401
curl http://localhost:3003/books

# 4. Try with a fake token -> 401
curl -H "Authorization: Bearer not-a-real-token" http://localhost:3003/books

# 5. See who you are
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/me

# 6. Try admin route as regular user -> 403
curl -X POST http://localhost:3003/books \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hacking","author":"Alice","genre":"security"}'

# 7. Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3003/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin-secret"}' | jq -r '.token')

curl -X POST http://localhost:3003/books \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Security Engineering","author":"Ross Anderson","genre":"security"}'

# 8. Logout — token is deleted server-side
curl -X POST http://localhost:3003/logout \
  -H "Authorization: Bearer $TOKEN"

# 9. Try the old token after logout -> 401
curl -H "Authorization: Bearer $TOKEN" http://localhost:3003/books
```

---

## Interview Questions

**Q: What makes a token "opaque"?**
A: An opaque token is a random string with no embedded meaning. The server has to look it up in a store to determine who it belongs to. Contrast this with a JWT, which carries signed claims the server can verify locally without any lookup.

**Q: How is token auth different from session auth?**
A: Session auth uses a cookie the browser manages automatically; the session data lives on the server. Token auth returns a value in the response body that the client explicitly stores and manually attaches to requests via the `Authorization` header. Conceptually similar, but the transport and storage decisions shift to the client.

**Q: Why does the server still need a DB lookup on every request?**
A: Because the token itself is opaque — it has no information in it. The server must query its token store to map the token to a user. This is the key weakness JWT solves.

**Q: How does logout work here vs Basic Auth?**
A: With Basic Auth, logout is impossible server-side — you can't invalidate credentials. With opaque tokens, the server simply deletes the token from its store. Any request presenting that token afterward finds no matching record and gets a 401.

---

## What's wrong with this approach? (Preview of Module 04)

Every single authenticated request requires a token store lookup. In a high-traffic system, that lookup — whether a Redis `GET` or a DB query — adds latency at scale.

What if the token could carry the user's identity inside itself, cryptographically signed, so the server could verify it without any lookup at all?

That's JWT. Module 04 encodes user claims directly in the token and uses a digital signature to guarantee they haven't been tampered with. The trade-off: you lose the ability to invalidate a token before it expires.
