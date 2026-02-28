# Module 04 — JWT Authentication

## What is it?

JSON Web Token (JWT) authentication. Like opaque tokens, but the token itself **encodes the user's identity** in a signed payload. The server can verify authenticity and read user claims **without any database lookup** — purely through cryptography.

Defined in [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519).

---

## How it works (plain English)

At login, the server signs a token containing the user's ID, username, role, and an expiry time. This token is handed to the client. On every subsequent request, the server verifies the token's **cryptographic signature** — if the signature is valid, the payload is trusted. No session store, no DB lookup.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfMSJ9.SIG
                       ^--- a real JWT: header.payload.signature
```

Because tokens expire quickly (15 minutes here), a **refresh token** is issued alongside the access token. The refresh token is long-lived (7 days) and stored server-side — it's the only thing that still requires a DB/store lookup.

---

## JWT Structure

A JWT is three base64url-encoded segments separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJzdWIiOiJ1c3JfMSIsInVzZXJuYW1lIjoiYWxpY2UiLCJyb2xlIjoidXNlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAwOTAwfQ
.
HMAC_SHA256_SIGNATURE
```

Decoded:

```json
// Header
{ "alg": "HS256", "typ": "JWT" }

// Payload (claims)
{
  "sub": "usr_1",        // subject — who the token is about
  "username": "alice",
  "role": "user",
  "iat": 1700000000,     // issued at (Unix timestamp)
  "exp": 1700000900      // expiry (15 minutes later)
}

// Signature
HMAC-SHA256(base64url(header) + "." + base64url(payload), SECRET)
```

**The payload is base64url encoded — not encrypted.** Anyone can decode it. Never put secrets in a JWT payload.

---

## The HTTP Flow

```
Client                                          Server
  |                                                |
  |  POST /login                                   |
  |  { username: "alice", password: "..." }       |
  |----------------------------------------------->|
  |                                                |  1. Verify password
  |  200 OK                                        |  2. Sign access token  (15m)
  |  { accessToken: "eyJ...", refreshToken: "..." }|  3. Sign refresh token (7d)
  |<-----------------------------------------------|     Store refresh token in store
  |                                                |
  |  GET /books                                    |
  |  Authorization: Bearer eyJ... (access token)  |
  |----------------------------------------------->|
  |                                                |  Verify signature -> decode claims
  |  200 OK                                        |  No DB lookup needed
  |  [ ...books ]                                  |
  |<-----------------------------------------------|
  |                                                |
  |  (15 minutes later — access token expired)     |
  |                                                |
  |  POST /refresh                                 |
  |  { refreshToken: "..." }                       |
  |----------------------------------------------->|
  |                                                |  Check refresh token in store
  |  200 OK                                        |  Verify refresh token signature
  |  { accessToken: "eyJ... (new)" }              |  Issue new access token
  |<-----------------------------------------------|
  |                                                |
  |  POST /logout                                  |
  |  { refreshToken: "..." }                       |
  |----------------------------------------------->|
  |                                                |  Remove refresh token from store
  |  200 OK                                        |  (access token remains valid until expiry)
  |<-----------------------------------------------|
```

---

## Access Token vs Refresh Token

| Property | Access Token | Refresh Token |
|---|---|---|
| Lifetime | Short (15 minutes) | Long (7 days) |
| Purpose | Authenticate API requests | Obtain new access tokens |
| Sent on | Every protected request | Only to `/refresh` |
| Stored server-side? | No | Yes (to enable revocation) |
| Can be invalidated early? | No | Yes — remove from store |

The short access token lifetime limits the damage window if it's stolen. The refresh token provides convenience without keeping the access token alive forever.

---

## HS256 vs RS256

This module uses **HS256** (HMAC-SHA256) — a symmetric algorithm. The same secret is used to both sign and verify. This means every service verifying the token must have the secret.

**RS256** (RSA-SHA256) is asymmetric:
- The **private key** signs the token (only the auth server has this)
- The **public key** verifies the token (any service can have this)

| | HS256 | RS256 |
|---|---|---|
| Key type | Shared secret | Public/private key pair |
| Who can verify? | Anyone with the secret | Anyone with the public key |
| Use case | Single server / monolith | Microservices, federated systems |
| Risk | Secret leakage = game over | Private key stays on auth server |

---

## The Revocation Problem

This is the central weakness of JWT and the most common interview topic.

When a user logs out, you can remove the refresh token from the store. But the **access token is still valid** until it expires. If an attacker steals an access token, they have access for up to 15 minutes (or however long the expiry is) even after the user logs out.

Options to mitigate this (all with trade-offs):
- **Short expiry** — 15 minutes limits the window (this is the standard approach)
- **Token blocklist** — store revoked JWTs in Redis; check on every request (but now you have a DB lookup again)
- **Refresh token rotation** — issue a new refresh token on every `/refresh` call; one-time use reduces theft window

There is no perfect solution. The choice between "truly stateless" and "truly revocable" is a fundamental trade-off.

---

## Weaknesses

| Weakness | Explanation |
|---|---|
| Access tokens can't be revoked | Valid until expiry — a logged-out user's stolen access token still works |
| Payload is not encrypted | Base64 is encoding, not encryption — don't put sensitive data in claims |
| Algorithm confusion attacks | A poorly configured library might accept `"alg": "none"` — always pin the algorithm |
| Secret leakage (HS256) | If the signing secret is compromised, all tokens can be forged |
| Token size | JWTs are larger than opaque tokens — increases request overhead |

---

## When is it actually used in production?

1. **SPAs and mobile apps** — tokens are easy to store and send without cookie infrastructure
2. **Microservices** — the auth service signs a token; downstream services verify it with the public key (RS256), no inter-service auth calls needed
3. **Cross-domain auth** — cookies have domain restrictions; JWTs in headers work anywhere
4. **OAuth 2.0 / OpenID Connect** — access tokens in these flows are often JWTs

---

## Run it

```bash
npm run 04:jwt-auth
```

## Test it with curl

```bash
# 1. Login — get access + refresh tokens
RESPONSE=$(curl -s -X POST http://localhost:3004/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}')

ACCESS=$(echo $RESPONSE | jq -r '.accessToken')
REFRESH=$(echo $RESPONSE | jq -r '.refreshToken')

echo "Access:  $ACCESS"
echo "Refresh: $REFRESH"

# 2. Decode the JWT payload (base64 — no secret needed!)
echo $ACCESS | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# 3. Access a protected route
curl -H "Authorization: Bearer $ACCESS" http://localhost:3004/books

# 4. Try without a token -> 401
curl http://localhost:3004/books

# 5. Try with a tampered token -> 401 (signature mismatch)
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3JfMSIsInJvbGUiOiJhZG1pbiJ9.FAKESIG" \
  http://localhost:3004/books

# 6. Get a new access token using the refresh token
NEW_ACCESS=$(curl -s -X POST http://localhost:3004/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq -r '.accessToken')

echo "New access token: $NEW_ACCESS"

# 7. Logout — invalidates the refresh token
curl -X POST http://localhost:3004/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"

# 8. Try to refresh after logout -> 401
curl -X POST http://localhost:3004/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"

# 9. The OLD access token still works until expiry — this is the revocation problem
curl -H "Authorization: Bearer $ACCESS" http://localhost:3004/me
```

---

## Interview Questions

**Q: Why can't you invalidate a JWT access token before it expires?**
A: The server is stateless with respect to access tokens — it doesn't store them anywhere. Verification is purely cryptographic. There's nothing to delete. To revoke early, you'd need a blocklist (which reintroduces server state). The standard mitigation is short expiry (15m).

**Q: Is the JWT payload encrypted?**
A: No. The payload is base64url-encoded, which is trivially reversible. `atob()` in the browser, or `base64 -d` in the terminal, decodes it instantly. JWTs are signed (integrity guaranteed), not encrypted (confidentiality not guaranteed). Use JWE (JSON Web Encryption) if you need to encrypt claims.

**Q: What's the difference between HS256 and RS256?**
A: HS256 is symmetric — the same secret signs and verifies. RS256 is asymmetric — a private key signs, a public key verifies. RS256 is preferable in microservice architectures where you want downstream services to verify tokens without holding the signing key.

**Q: Why issue a refresh token at all — why not just make the access token last 7 days?**
A: A short-lived access token limits the damage window if it's stolen. The refresh token is long-lived but only used at one endpoint (`/refresh`) and can be revoked server-side. The access token is used on every request and can't be revoked — so you want it to expire quickly.

**Q: What is an algorithm confusion attack?**
A: Some early JWT libraries would accept `"alg": "none"` in the header, meaning no signature verification. An attacker could forge a token with any claims and set `alg: none` to bypass verification entirely. Always explicitly specify the expected algorithm when calling `jwt.verify()`.

---

## What's wrong with this approach? (Preview of Module 05)

JWT solves the server-side lookup problem, but there's a bigger question it doesn't address: **who manages identity in the first place?**

In all modules so far, each app has its own user store and its own login page. If a user has accounts on 10 different services, they have 10 passwords. And if a third-party app wants to act on your behalf, you'd have to give it your password.

Module 05 (OAuth) introduces a dedicated **Authorization Server** (IdP). Users log in once, and third-party apps are granted limited, revocable access — without ever seeing the user's password.
