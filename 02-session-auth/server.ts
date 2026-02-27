import express from "express";
import session from "express-session";
import { findUserByUsername, verifyPassword } from "../shared/data/users";
import { requireSession, requireRole } from "./middleware/sessionAuth";
import { getAllBooks, getBookById, addBook, deleteBook } from "../shared/data/books";

const app = express();
const PORT = 3002;

app.use(express.json());

// Session middleware — configure it here before any routes
// Key options to understand: secret, resave, saveUninitialized, cookie
app.use(
  session({
    // TODO: configure session options
    // Hint: secret, resave, saveUninitialized, cookie { httpOnly, secure, maxAge, sameSite }
    secret: "dev-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.get("/", (_req, res) => {
  res.json({ module: "02 - Session Auth", port: PORT });
});

// POST /login — verify credentials, create session, send cookie
app.post("/login", async (req, res) => {
  // TODO: extract username + password from req.body
  // TODO: look up the user
  // TODO: verify password
  // TODO: store user in req.session.user
  // TODO: send success response
});

// POST /logout — destroy the session
app.post("/logout", (req, res) => {
  // TODO: call req.session.destroy()
  // TODO: clear the cookie
  // TODO: send success response
});

// GET /me — who is the current session user?
app.get("/me", requireSession, (req, res) => {
  // TODO
});

// Protected book routes — same as module 01 but using requireSession instead of basicAuth
app.get("/books", requireSession, (_req, res) => {
  // TODO
});

app.get("/books/:id", requireSession, (req, res) => {
  // TODO
});

app.post("/books", requireSession, requireRole("admin"), (req, res) => {
  // TODO
});

app.delete("/books/:id", requireSession, requireRole("admin"), (req, res) => {
  // TODO
});

app.listen(PORT, () => {
  console.log(`[Module 02] Session Auth running on http://localhost:${PORT}`);
});
