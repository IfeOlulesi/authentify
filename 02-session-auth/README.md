# Module 02 — Session Authentication

## What is it?

A stateful authentication scheme where credentials are only sent **once** (at login). The server creates a session, stores user data server-side, and hands the client a session ID via a cookie. Every subsequent request presents that cookie — not the password.

---

## How it works (plain English)

On login, the server verifies credentials, creates a session entry in its session store (MemoryStore in development, Redis in production), and responds with a `Set-Cookie` header containing an opaque session ID.

```
Set-Cookie: connect.sid=s%3Axyz...; Path=/; HttpOnly; SameSite=Lax
```

On every subsequent request, the browser automatically attaches the cookie. The server extracts the session ID, looks up the matching session data, and knows who the user is — **no password involved**.

The password never travels over the wire again after the initial login.

---

## The HTTP Flow

```
Client                                     Server
  |                                           |
  |  POST /login                              |
  |  { username: "alice", password: "..." }  |
  |----------------------------------------->|
  |                                           |  1. Verify password with bcrypt
  |  200 OK                                  |  2. Create session in MemoryStore
  |  Set-Cookie: connect.sid=s%3Axyz...      |  3. Send back session ID cookie
  |<-----------------------------------------|
  |                                           |
  |  GET /books                               |
  |  Cookie: connect.sid=s%3Axyz...          |
  |----------------------------------------->|
  |                                           |  Look up session ID -> user data
  |  200 OK                                  |
  |  [ ...books ]                            |
  |<-----------------------------------------|
  |                                           |
  |  POST /logout                             |
  |  Cookie: connect.sid=s%3Axyz...          |
  |----------------------------------------->|
  |                                           |  Destroy session in store
  |  200 OK                                  |
  |  Set-Cookie: connect.sid=; Max-Age=0     |  Clear cookie on client
  |<-----------------------------------------|
```

---

## Cookie flags: what they do and why they matter

| Flag | What it does |
|---|---|
| `HttpOnly` | JavaScript cannot read the cookie. Protects against XSS token theft. |
| `Secure` | Cookie is only sent over HTTPS. Prevents interception in transit. |
| `SameSite=Lax` | Cookie is not sent on cross-site POST requests. Mitigates CSRF. |
| `maxAge` | How long the cookie lives. After this, the browser discards it. |

---

## Session vs Cookie — the distinction

The **cookie** only holds the session ID (a random string). The actual user data (`{ id, username, role }`) lives on the **server** in the session store.

```
Cookie:         connect.sid = "s%3Axyz123"   <- just an ID
Session Store:  "xyz123" -> { user: { id: "usr_1", username: "alice", role: "user" } }
```

If the session store is wiped, all sessions are invalidated — even if the client still has a valid-looking cookie.

---

## Weaknesses

| Weakness | Explanation |
|---|---|
| Server must store state | Sessions must live somewhere — MemoryStore doesn't survive restarts, Redis adds infrastructure |
| Horizontal scaling is harder | Multiple servers need a shared session store (Redis), otherwise sessions break when requests hit different instances |
| CSRF (Cross-Site Request Forgery) | Browsers send cookies automatically on cross-site requests — a malicious site can forge authenticated requests. Mitigated by `SameSite` and CSRF tokens |
| Session fixation | Attacker tricks victim into using a known session ID. Mitigated by regenerating the session ID on login |
| Logout only invalidates server-side | A stolen cookie is still valid until the session expires unless actively destroyed |

---

## When is it actually used in production?

1. **Traditional server-rendered web apps** — Django, Rails, Laravel all use sessions by default
2. **Apps where server-side logout is a hard requirement** — banking, internal tools
3. **Multi-page apps where cookies flow naturally** — the browser handles everything automatically
4. **Less ideal for APIs** consumed by mobile apps or SPAs — those prefer token-based approaches (modules 03/04)

---

## Run it

```bash
npm run 02:session-auth
```

## Test it with curl

```bash
# 1. Login — server creates session, sends back Set-Cookie
curl -i -c cookies.txt -X POST http://localhost:3002/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

# 2. Access protected route using the saved cookie
curl -b cookies.txt http://localhost:3002/books

# 3. See who the current session belongs to
curl -b cookies.txt http://localhost:3002/me

# 4. Try admin-only route as regular user -> 403
curl -b cookies.txt -X POST http://localhost:3002/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Hacking","author":"Alice","genre":"security"}'

# 5. Login as admin and do the same
curl -i -c admin-cookies.txt -X POST http://localhost:3002/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin-secret"}'

curl -b admin-cookies.txt -X POST http://localhost:3002/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Security Engineering","author":"Ross Anderson","genre":"security"}'

# 6. Logout — session destroyed server-side
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3002/logout

# 7. Try to use the old cookie after logout -> 401
curl -b cookies.txt http://localhost:3002/books
```

---

## Interview Questions

**Q: What's the difference between a session and a cookie?**
A: A cookie is a small piece of data stored by the browser and sent on every request to the matching domain. In session auth, the cookie only contains a session ID. The actual session data (user info, roles) lives on the server. The cookie is just a key to look it up.

**Q: What does `HttpOnly` protect against?**
A: It prevents JavaScript from reading the cookie via `document.cookie`. This blocks XSS attacks from stealing the session ID — the script runs in the browser, but can't access the cookie.

**Q: How do you scale session auth across multiple servers?**
A: Each server needs access to the same session store. In development, MemoryStore works (single process only). In production, you use a shared external store like Redis. Load balancers can also be configured for "sticky sessions" (same client always hits the same server), but that's fragile.

**Q: Why can't you fully log someone out with Basic Auth but you can with sessions?**
A: Basic Auth is stateless — there's nothing server-side to invalidate. With sessions, the server controls the session store. Deleting the session entry immediately invalidates the session ID, regardless of whether the client still has the cookie.

---

## What's wrong with this approach? (Preview of Module 03)

Sessions require the server to store state for every active user. That session store becomes a **single point of failure** and a **scaling bottleneck**. And on every request, the server still has to do a lookup: "who owns this session ID?"

Module 03 (Token Auth) explores moving the token to the client entirely — but the lookup problem remains. Module 04 (JWT) is where we finally eliminate the server-side lookup altogether.
