import express from "express";
import { v4 as uuidv4 } from "uuid";
import { findUserByUsername, verifyPassword, users } from "../shared/data/users";
import { tokenAuth, requireRole } from "./middleware/tokenAuth";
import { getAllBooks, getBookById, addBook, deleteBook } from "../shared/data/books";

const app = express();
const PORT = 3003;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ module: "03 - Token Auth", port: PORT });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /login — verify credentials, issue an opaque Bearer token
//
// This is the one route that touches the password. After this, the client
// attaches the returned token to every request via the Authorization header —
// no password ever travels again.
//
// Unlike session auth, there's no cookie. The client must:
//   a) receive the token from this response body
//   b) choose where to store it (localStorage, memory, etc.)
//   c) manually attach it as: Authorization: Bearer <token>
//
// That storage decision is now the client's responsibility and the source of
// the XSS-vs-CSRF trade-off documented in the README.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Bad Request", message: "username and password are required" });
    return;
  }

  const user = findUserByUsername(username);

  // Always run bcrypt even when the user doesn't exist.
  // Without this, an attacker could time the response: "user not found" returns
  // instantly, "wrong password" takes ~100ms (bcrypt cost). That timing side-channel
  // reveals which usernames are registered — a significant info leak.
  const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !validPassword) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  // Generate a cryptographically random UUID v4. This is our opaque token.
  // UUID v4 is 122 bits of randomness — brute-forcing is computationally infeasible.
  // It carries zero information about the user — just a random key into the store.
  const token = uuidv4();

  // Store the token directly on the user record in our in-memory store.
  // A user can have multiple tokens (multiple devices/sessions). Logging out
  // from one device only removes that device's token.
  //
  // In production: INSERT INTO tokens (user_id, token, created_at) VALUES (...)
  // or in Redis:   SET token:<uuid> <user_id> EX 86400
  user.tokens.push(token);

  res.status(200).json({
    message: "Login successful",
    token,
    // Tell the client exactly how to use it. In a real API this would be in docs.
    hint: "Send this token as: Authorization: Bearer <token>",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /logout — server-side token invalidation
//
// This is the key advantage over Basic Auth (which has no server-side logout).
// Removing the token from the store makes it permanently worthless — any
// subsequent request presenting that token will get a 401 from tokenAuth.
//
// tokenAuth middleware runs first, so by the time this handler executes:
//   - the token has already been validated (user exists with this token)
//   - req.user is populated
//
// We extract the token again from the header to know which specific token to
// remove (a user may have multiple tokens for multiple devices).
// ─────────────────────────────────────────────────────────────────────────────

app.post("/logout", tokenAuth, (req, res) => {
  // tokenAuth already validated the header format, so this is safe to extract.
  const token = req.headers.authorization!.slice(7).trim();

  // Find the user record — req.user.id gives us a reliable lookup key.
  // We could also re-scan users.find() but using req.user.id is O(n) on users,
  // not O(n×m) on users×tokens.
  const user = users.find(u => u.id === req.user!.id);

  if (user) {
    // Remove this specific token. Other tokens (other devices) remain valid.
    // filter creates a new array without mutating the original — important for
    // thread-safety if you ever move to async operations.
    user.tokens = user.tokens.filter(t => t !== token);
  }

  // The token is now gone from the server. Any request presenting it will
  // find no matching user and receive a 401 from tokenAuth.
  //
  // The client should also discard the token from its storage —
  // but even if it doesn't, the token is worthless server-side.
  res.status(200).json({ message: "Logged out successfully. Token invalidated." });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /me — inspect who the token belongs to
//
// Useful for: "who am I logged in as?" — the client receives the user object
// that was decoded from the token lookup in tokenAuth.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/me", tokenAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOK ROUTES — same API surface as modules 01 and 02
//
// The handlers themselves are identical across modules. The ONLY difference
// between this module and module 01 (basic auth) or 02 (session auth) is the
// middleware: tokenAuth vs basicAuth vs requireSession.
//
// Route handlers are completely decoupled from the auth mechanism.
// This is the payoff of the req.user convention: all routes just read req.user,
// and you can swap authentication strategies without touching route logic.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/books", tokenAuth, (_req, res) => {
  res.status(200).json(getAllBooks());
});

app.get("/books/:id", tokenAuth, (req, res) => {
  const book = getBookById(Number(req.params.id));

  if (!book) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json(book);
});

app.post("/books", tokenAuth, requireRole("admin"), (req, res) => {
  const { title, author, genre } = req.body;

  if (!title || !author || !genre) {
    res.status(400).json({ error: "Bad Request", message: "title, author, and genre are required" });
    return;
  }

  const book = addBook(title, author, genre, req.user!.username);
  res.status(201).json(book);
});

app.delete("/books/:id", tokenAuth, requireRole("admin"), (req, res) => {
  const deleted = deleteBook(Number(req.params.id));

  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json({ message: `Book ${req.params.id} deleted` });
});

app.listen(PORT, () => {
  console.log(`[Module 03] Token Auth running on http://localhost:${PORT}`);
});
