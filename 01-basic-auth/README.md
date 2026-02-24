# Module 01 — Basic Authentication

## What is it?

The oldest and simplest form of HTTP authentication. Defined in [RFC 7617](https://datatracker.ietf.org/doc/html/rfc7617).

---

## How it works (plain English)

Every single request carries the username and password, encoded in base64, inside the `Authorization` header.

```
Authorization: Basic YWxpY2U6cGFzc3dvcmQxMjM=
                      ^--- base64("alice:password123")
```

The server decodes this on every request, looks up the user, and verifies the password via bcrypt.

**There is no session, no token, no state.** The server is completely stateless.

---

## The HTTP Flow

```
Client                                     Server
  |                                           |
  |  GET /books                               |
  |  (no Authorization header)               |
  |----------------------------------------->|
  |                                           |
  |  401 Unauthorized                        |
  |  WWW-Authenticate: Basic realm="..."     |
  |<-----------------------------------------|
  |                                           |
  |  GET /books                               |
  |  Authorization: Basic YWxpY2U6...        |
  |----------------------------------------->|
  |                                           |
  |  200 OK                                  |
  |  [ ...books ]                            |
  |<-----------------------------------------|
```

The `WWW-Authenticate` response header is what makes browsers show a username/password popup. REST clients (curl, Postman) read it too.

---

## Is base64 encryption?

**No.** Base64 is encoding, not encryption. It's completely reversible:

```bash
echo -n "alice:password123" | base64
# YWxpY2U6cGFzc3dvcmQxMjM=

echo "YWxpY2U6cGFzc3dvcmQxMjM=" | base64 -d
# alice:password123
```

Anyone who can intercept the header can decode it in milliseconds. **Basic Auth must only be used over HTTPS (TLS)**, where the entire HTTP request (including headers) is encrypted by TLS — not by Basic Auth itself.

---

## Weaknesses

| Weakness | Explanation |
|---|---|
| Credentials on every request | If one request is intercepted, game over |
| No logout | Server-side logout is impossible — you can't "invalidate" credentials |
| No expiry | Credentials are valid forever until password changes |
| Replay attacks | A captured header can be replayed indefinitely |
| Password exposure | Bugs/logs might accidentally capture the Authorization header |

---

## When is it actually used in production?

1. **Server-to-server API calls** where both sides are trusted and TLS is guaranteed
2. **Internal tooling** (CI/CD, internal dashboards) behind a VPN
3. **Simple webhooks** where you control both sender and receiver
4. **Never** for user-facing login flows in 2024

---

## Run it

```bash
npm run 01:basic-auth
```

## Test it with curl

```bash
# 1. Hit without credentials -> 401
curl -i http://localhost:3001/books

# 2. Hit with wrong credentials -> 401
curl -i -u alice:wrongpassword http://localhost:3001/books

# 3. Hit with valid user credentials -> 200
curl -u alice:password123 http://localhost:3001/books

# 4. Try to add a book as a regular user -> 403
curl -u alice:password123 -X POST http://localhost:3001/books \
  -H "Content-Type: application/json" \
  -d '{"title":"My Book","author":"Alice","genre":"test"}'

# 5. Add a book as admin -> 201
curl -u admin:admin-secret -X POST http://localhost:3001/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Security Engineering","author":"Ross Anderson","genre":"security"}'

# 6. Delete a book as admin -> 200
curl -u admin:admin-secret -X DELETE http://localhost:3001/books/1

# 7. See what the raw header looks like
echo -n "alice:password123" | base64
# Then manually: curl -H "Authorization: Basic <that-value>" http://localhost:3001/books
```

---

## Interview Questions

**Q: Why isn't Basic Auth considered secure on its own?**
A: The credentials are only base64-encoded (not encrypted). They're vulnerable to interception unless the transport is encrypted with TLS. Even with TLS, credentials travel on every request, increasing attack surface vs. session/token-based approaches.

**Q: Can you implement logout with Basic Auth?**
A: Not from the server side. You'd have to change the password or tell the client to stop sending the header. Some browsers cache Basic Auth credentials for the session — clearing that cache is client-side only.

**Q: What's the `WWW-Authenticate` header for?**
A: It's the server's way of telling the client which authentication scheme to use. `Basic realm="X"` means "use HTTP Basic Auth, and 'X' is the name of the protected area being accessed."

---

## What's wrong with this approach? (Preview of Module 02)

The fundamental problem: **statelessness cuts both ways**. Every request must include the password. That means:
- More opportunities for the password to be captured
- No revocation — can't log someone out
- No session lifetime — credentials never expire unless the password changes

Module 02 (Session Auth) fixes this by sending credentials once, getting a session cookie back, and then using that cookie for subsequent requests — keeping the password off the wire after login.
