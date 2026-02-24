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
  res.json(getAllBooks());
});

// GET /books/:id — authenticated users only
app.get("/books/:id", basicAuth, (req, res) => {
  const book = getBookById(Number(req.params.id));
  if (!book) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json(book);
});

// POST /books — admin only
app.post("/books", basicAuth, requireRole("admin"), (req, res) => {
  const { title, author, genre } = req.body;
  if (!title || !author || !genre) {
    res.status(400).json({ error: "Bad Request", message: "title, author, and genre are required" });
    return;
  }
  const book = addBook(title, author, genre, req.user!.username);
  res.status(201).json(book);
});

// DELETE /books/:id — admin only
app.delete("/books/:id", basicAuth, requireRole("admin"), (req, res) => {
  const deleted = deleteBook(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ message: "Book deleted" });
});

app.listen(PORT, () => {
  console.log(`[Module 01] Basic Auth running on http://localhost:${PORT}`);
});
