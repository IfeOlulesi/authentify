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

// POST /login — verify credentials, generate token, store it, return it
app.post("/login", async (req, res) => {
  // TODO: verify username + password (same as session module)
  // TODO: generate a token with uuidv4()
  // TODO: push the token into the user's tokens array (user.tokens.push(token))
  // TODO: return the token in the response body
  //       { token: "..." } — client stores this (localStorage, memory, etc.)
});

// POST /logout — invalidate the token server-side
app.post("/logout", tokenAuth, (req, res) => {
  // TODO: extract the token from the Authorization header
  // TODO: find the user and remove the token from their tokens array
  //       Hint: user.tokens = user.tokens.filter(t => t !== token)
  // TODO: send success response
  // Think about: what happens to the token on the client after this?
});

// GET /me
app.get("/me", tokenAuth, (req, res) => {
  // TODO
});

// Protected book routes — using tokenAuth middleware
app.get("/books", tokenAuth, (_req, res) => {
  // TODO
});

app.get("/books/:id", tokenAuth, (req, res) => {
  // TODO
});

app.post("/books", tokenAuth, requireRole("admin"), (req, res) => {
  // TODO
});

app.delete("/books/:id", tokenAuth, requireRole("admin"), (req, res) => {
  // TODO
});

app.listen(PORT, () => {
  console.log(`[Module 03] Token Auth running on http://localhost:${PORT}`);
});
