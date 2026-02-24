import express from "express";
import { basicAuth, requireRole } from "./middleware/basicAuth";
import { getAllBooks, getBookById, addBook, deleteBook } from "../shared/data/books";

const app = express();
const PORT = 3001;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ module: "01 - Basic Auth", port: PORT });
});

// GET /books — authenticated users only
app.get("/books", basicAuth, (_req, res) => {
  // TODO
});

// GET /books/:id — authenticated users only
app.get("/books/:id", basicAuth, (req, res) => {
  // TODO
});

// POST /books — admin only
app.post("/books", basicAuth, requireRole("admin"), (req, res) => {
  // TODO
});

// DELETE /books/:id — admin only
app.delete("/books/:id", basicAuth, requireRole("admin"), (req, res) => {
  // TODO
});

app.listen(PORT, () => {
  console.log(`[Module 01] Basic Auth running on http://localhost:${PORT}`);
});
