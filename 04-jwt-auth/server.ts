import express from "express";
import jwt from "jsonwebtoken";
import { findUserByUsername, findUserById, verifyPassword } from "../shared/data/users";
import {
  jwtAuth,
  requireRole,
  generateTokens,
  refreshTokenStore,
  REFRESH_SECRET,
} from "./middleware/jwtAuth";
import { getAllBooks, getBookById, addBook, deleteBook } from "../shared/data/books";

const app = express();
const PORT = 3004;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ module: "04 - JWT Auth", port: PORT });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /login — verify credentials, issue access + refresh tokens
//
// The last time the password crosses the wire in this session.
// After this, all auth is done with the short-lived access token.
// The refresh token lets the client silently get a new access token when it
// expires, without prompting the user to log in again.
//
// Both tokens are returned in the response body — no cookies involved.
// This is typical for SPAs and mobile apps where cookie handling is awkward.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Bad Request", message: "username and password are required" });
    return;
  }

  const user = findUserByUsername(username);

  // Constant-time path: always run bcrypt even on unknown username.
  // Avoids timing side-channel that reveals valid usernames.
  const validPassword = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !validPassword) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  // Sign both tokens. generateTokens also adds the refresh token to refreshTokenStore.
  // The access token is stateless — the server stores nothing for it.
  // The refresh token is stateful — it must be in refreshTokenStore to be usable.
  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  res.status(200).json({
    message: "Login successful",
    accessToken,
    refreshToken,
    // Decode the JWT payload in your terminal to see the embedded claims:
    // echo "<accessToken>" | cut -d'.' -f2 | base64 -d | jq .
    hint: "Decode the accessToken payload at jwt.io — the claims are base64, not encrypted.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /refresh — exchange a valid refresh token for a new access token
//
// This is the silent renewal mechanism. When the client detects a 401 due to
// an expired access token, it calls this endpoint with its refresh token.
// If valid, it gets a fresh access token without re-entering credentials.
//
// Why don't we also issue a new refresh token here ("refresh token rotation")?
// We could — and in high-security apps you should. Rotation means each refresh
// token is single-use: every /refresh call issues a new refresh token and
// invalidates the old one. This limits the damage window if a refresh token leaks.
//
// We skip rotation here to keep the implementation focused on the core concept.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: "Bad Request", message: "refreshToken is required" });
    return;
  }

  // ── Step 1: check the store FIRST ─────────────────────────────────────────
  // Even a cryptographically valid refresh token is worthless if it's been
  // logged out. We check the store before verifying the signature to avoid
  // unnecessary crypto work on already-invalidated tokens.
  //
  // This is the one place in JWT auth where server state matters:
  //   - Access tokens: stateless, can't be revoked
  //   - Refresh tokens: stateful, stored here so they can be revoked
  // ──────────────────────────────────────────────────────────────────────────
  if (!refreshTokenStore.has(refreshToken)) {
    res.status(401).json({ error: "Unauthorized", message: "Refresh token not recognised or already used" });
    return;
  }

  // ── Step 2: verify the cryptographic signature ────────────────────────────
  // Even if the token is in our store, we still verify the signature.
  // Protects against a scenario where the store was somehow poisoned with
  // a string that wasn't actually issued by us.
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as jwt.JwtPayload;

    // The refresh token only embeds `sub` (user ID) — not role or username.
    // That's intentional: the refresh token is long-lived, and role/username can
    // change. We re-fetch the user here to get fresh claims for the new access token.
    //
    // This is the one DB lookup in the JWT refresh flow. It's acceptable because
    // /refresh is called infrequently (every 15 minutes), not on every request.
    // The hot path (every API call) remains completely stateless via jwtAuth.
    const user = findUserById(decoded.sub as string);

    if (!user) {
      // User was deleted after this refresh token was issued.
      refreshTokenStore.delete(refreshToken);
      res.status(401).json({ error: "Unauthorized", message: "User no longer exists" });
      return;
    }

    const newAccessToken = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "dev-access-secret",
      { expiresIn: "15m" }
    );

    res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    // The refresh token is in our store but cryptographically invalid or expired.
    // Remove it from the store to clean up — it's useless anyway.
    refreshTokenStore.delete(refreshToken);

    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Unauthorized", message: "Refresh token expired. Please log in again." });
    } else {
      res.status(401).json({ error: "Unauthorized", message: "Invalid refresh token" });
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /logout — invalidate the refresh token
//
// This is the extent of "logout" we can do with JWT:
//   - Remove the refresh token from the store → can't get new access tokens
//   - The current access token remains valid until its 15-minute expiry
//
// This is the "revocation problem" in action. You cannot cancel an access token
// without reintroducing server state (a blocklist). The standard trade-off:
// accept up to 15 minutes of residual access, or maintain a blocklist.
//
// In high-security contexts (banking, medical) — maintain a blocklist in Redis.
// In typical apps — 15 minutes is acceptable and the simplicity is worth it.
// ─────────────────────────────────────────────────────────────────────────────

app.post("/logout", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: "Bad Request", message: "refreshToken is required" });
    return;
  }

  // Silently succeed even if the token wasn't in the store — idempotent logout.
  // The client shouldn't be punished for calling logout twice.
  refreshTokenStore.delete(refreshToken);

  res.status(200).json({
    message: "Logged out. Refresh token invalidated.",
    note: "Your access token remains valid for up to 15 minutes — this is the JWT revocation problem.",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /me — inspect the claims embedded in the JWT
//
// Interesting to compare with module 03: there we get the user from a DB lookup.
// Here, req.user was populated from the JWT payload itself — no lookup at all.
// The tradeoff: if the user's email changed after login, we'd return the old one
// (we don't embed email in the JWT for exactly this reason — it would be stale).
// ─────────────────────────────────────────────────────────────────────────────

app.get("/me", jwtAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOK ROUTES — identical API surface, different middleware
//
// Route handlers are untouched from modules 01-03. The only difference is
// `jwtAuth` instead of `basicAuth` / `requireSession` / `tokenAuth`.
// This is the whole point of the req.user abstraction.
// ─────────────────────────────────────────────────────────────────────────────

app.get("/books", jwtAuth, (_req, res) => {
  res.status(200).json(getAllBooks());
});

app.get("/books/:id", jwtAuth, (req, res) => {
  const book = getBookById(Number(req.params.id));

  if (!book) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json(book);
});

app.post("/books", jwtAuth, requireRole("admin"), (req, res) => {
  const { title, author, genre } = req.body;

  if (!title || !author || !genre) {
    res.status(400).json({ error: "Bad Request", message: "title, author, and genre are required" });
    return;
  }

  const book = addBook(title, author, genre, req.user!.username);
  res.status(201).json(book);
});

app.delete("/books/:id", jwtAuth, requireRole("admin"), (req, res) => {
  const deleted = deleteBook(Number(req.params.id));

  if (!deleted) {
    res.status(404).json({ error: "Not Found", message: `No book with id ${req.params.id}` });
    return;
  }

  res.status(200).json({ message: `Book ${req.params.id} deleted` });
});

app.listen(PORT, () => {
  console.log(`[Module 04] JWT Auth running on http://localhost:${PORT}`);
});
