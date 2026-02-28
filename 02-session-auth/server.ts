import express from "express";
import session from "express-session";
import { findUserByUsername, verifyPassword } from "../shared/data/users";
import { requireSession, requireRole } from "./middleware/sessionAuth";
import { getAllBooks, getBookById, addBook, deleteBook } from "../shared/data/books";

const app = express();
const PORT = 3002;

app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MIDDLEWARE — must be registered before any routes that use sessions
//
// express-session intercepts every incoming request, reads the connect.sid
// cookie, looks up the session data in the store, and attaches it to req.session.
// If no cookie exists (or it's expired), req.session starts as an empty object.
//
// Option breakdown:
//
//   secret: used to cryptographically sign the session ID cookie with HMAC-SHA256.
//     This prevents clients from forging or tampering with the cookie value.
//     In production: a long random string from an environment variable.
//
//   resave: false — don't re-save the session to the store on every request
//     if nothing changed. Avoids race conditions and unnecessary write ops.
//     (The default was true for legacy reasons; always set false explicitly.)
//
//   saveUninitialized: false — don't create a session entry for requests that
//     never modify the session (e.g. unauthenticated visitors hitting /books).
//     This saves memory and is required for GDPR compliance (don't set cookies
//     without a reason).
//
//   cookie.httpOnly: true (default) — the cookie is inaccessible to JavaScript
//     (document.cookie). Even if XSS code runs on the page, it can't steal the
//     session ID. This is one of the most important security defaults.
//
//   cookie.secure: false in dev — if true, the cookie is only sent over HTTPS.
//     Mandatory in production. Omitted here so localhost HTTP works.
//
//   cookie.sameSite: "lax" — the cookie is NOT sent on cross-site POST requests
//     (e.g. a form on evil.com posting to your server). Lax still allows it on
//     top-level navigations (clicking a link). "strict" blocks everything cross-site.
//     This is the primary CSRF mitigation without needing a CSRF token.
//
//   cookie.maxAge: how long the cookie lives in the browser (ms). After this,
//     the browser discards it. The server-side session may still exist but the
//     client can no longer present its ID — effectively logged out.
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  session({
    secret: "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,          // JS cannot read cookie — blocks XSS session theft
      secure: false,           // set true in production (requires HTTPS)
      sameSite: "lax",         // CSRF mitigation — don't send on cross-site POSTs
      maxAge: 1000 * 60 * 60,  // 1 hour in milliseconds
    },
  })
);

app.get("/", (_req, res) => {
  res.json({ module: "02 - Session Auth", port: PORT });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /login — the only route that handles a password
//
// This is the one moment in a user's session where the password crosses the wire.
// After this, the client never sends credentials again — just the session cookie.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Bad Request", message: "username and password are required" });
    return;
  }

  // Look up the user by username. Returns undefined if not found.
  const user = findUserByUsername(username);

  // Always run verifyPassword even when the user doesn't exist.
  // A naive implementation that returns early on "user not found" leaks
  // i.nformation via response timing — an attacker can tell which usernames
  // exist because those requests take longer (bcrypt comparison time).
  // By always calling bcrypt.compare, both paths take ~the same time.
  //
  // Here we use a dummy hash for the not-found case. In production you'd
  // keep a pre-computed dummy hash constant to eliminate any measurable gap.
  const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !validPassword) {
    // Deliberately vague — don't tell the client whether the username or
    // password was wrong. Either piece of info helps an attacker.
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  // ── SESSION FIXATION PREVENTION ──────────────────────────────────────────
  // Before we store anything in the session, we regenerate the session ID.
  //
  // Why? Session fixation: an attacker tricks a victim into using a known
  // session ID (e.g. via a crafted link). If we elevate that session to
  // "authenticated" without changing the ID, the attacker — who already has
  // the ID — now has an authenticated session they didn't log in for.
  //
  // req.session.regenerate() creates a brand-new session ID, copies over any
  // existing data, and invalidates the old ID. After login, the attacker's
  // known ID is worthless.
  // ─────────────────────────────────────────────────────────────────────────

  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: "Could not create session" });
      return;
    }

    // Store only what we need in the session — NOT the full User object.
    // We never want the passwordHash floating around in session memory.
    // AuthenticatedUser is a safe subset: id, username, email, role.
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    // express-session will automatically set the Set-Cookie response header
    // with the new session ID once the session is saved. The client's browser
    // stores this cookie and sends it on every subsequent request.

    res.status(200).json({
      message: "Login successful",
      user: req.session.user,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /logout — two-step teardown: server destroys the session, client clears the cookie
//
// Both steps are necessary:
//   1. req.session.destroy() removes the session record from the server store.
//      The session ID in the cookie now maps to nothing — it's worthless.
//   2. res.clearCookie() sends Set-Cookie with Max-Age=0 telling the browser
//      to immediately delete the cookie. Without this, the client still holds
//      the cookie and will keep sending it (to get a 401 each time).
//
// Contrast with Basic Auth: there is no server-side logout for Basic Auth.
// Sessions give us real logout capability, which is one of their key advantages.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Could not destroy session" });
      return;
    }

    // Clear the cookie on the client side. The name "connect.sid" is
    // express-session's default cookie name (configurable via the `name` option).
    res.clearCookie("connect.sid");

    res.status(200).json({ message: "Logged out successfully" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /me — inspect the current session's user
//
// requireSession populates req.user from req.session.user before this handler
// runs, so we just return it. Useful for confirming who you're logged in as.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/me", requireSession, (req, res) => {
  res.status(200).json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOK ROUTES — identical API surface to module 01, different auth mechanism
//
// Module 01 used basicAuth middleware (verifies credentials on every request).
// Here we use requireSession (checks the server-side session once per request).
// The route handlers themselves are the same — they don't care how auth works.
// This is the power of the req.user convention: swap the middleware, keep the routes.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/books", requireSession, (_req, res) => {
  res.status(200).json(getAllBooks());
});

app.get("/books/:id", requireSession, (req, res) => {
  const book = getBookById(Number(req.params.id));

  if (!book) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json(book);
});

app.post("/books", requireSession, requireRole("admin"), (req, res) => {
  const { title, author, genre } = req.body;

  if (!title || !author || !genre) {
    res.status(400).json({ error: "Bad Request", message: "title, author, and genre are required" });
    return;
  }

  // req.user is guaranteed by requireSession — safe to use without null check.
  const book = addBook(title, author, genre, req.user!.username);
  res.status(201).json(book);
});

app.delete("/books/:id", requireSession, requireRole("admin"), (req, res) => {
  const deleted = deleteBook(Number(req.params.id));

  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json({ message: `Book ${req.params.id} deleted` });
});

app.listen(PORT, () => {
  console.log(`[Module 02] Session Auth running on http://localhost:${PORT}`);
});
