import express from "express";
import jwt from "jsonwebtoken";
import { findUserByUsername, verifyPassword } from "../shared/data/users";
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

// POST /login — verify credentials, issue access + refresh tokens
app.post("/login", async (req, res) => {
  // TODO: verify username + password
  // TODO: call generateTokens() with user payload
  // TODO: return { accessToken, refreshToken } in response body
});

// POST /refresh — exchange a valid refresh token for a new access token
app.post("/refresh", (req, res) => {
  // TODO: get refreshToken from req.body
  // TODO: check it exists in refreshTokenStore (otherwise it's been logged out)
  // TODO: verify with jwt.verify(refreshToken, REFRESH_SECRET)
  // TODO: issue a new access token (NOT a new refresh token)
  // TODO: return { accessToken }
  //
  // Think about: why don't we issue a new refresh token here too?
});

// POST /logout — invalidate the refresh token
app.post("/logout", (req, res) => {
  // TODO: get refreshToken from req.body
  // TODO: remove it from refreshTokenStore
  // TODO: send success response
  //
  // Think about: what happens to the access token after logout?
  // Can we invalidate it? What does this mean for security?
});

// GET /me
app.get("/me", jwtAuth, (req, res) => {
  // TODO
});

// Protected book routes
app.get("/books", jwtAuth, (_req, res) => {
  // TODO
});

app.get("/books/:id", jwtAuth, (req, res) => {
  // TODO
});

app.post("/books", jwtAuth, requireRole("admin"), (req, res) => {
  // TODO
});

app.delete("/books/:id", jwtAuth, requireRole("admin"), (req, res) => {
  // TODO
});

app.listen(PORT, () => {
  console.log(`[Module 04] JWT Auth running on http://localhost:${PORT}`);
});
