import { Book } from "../types";

// The protected resource — all 6 modules will restrict access to this data.
//
// Endpoints (consistent across all modules):
//   GET    /books        -> list all     (authenticated users)
//   GET    /books/:id    -> single book  (authenticated users)
//   POST   /books        -> add book     (admin only)
//   DELETE /books/:id    -> delete book  (admin only)

export const books: Book[] = [
  { id: 1, title: "Clean Code", author: "Robert C. Martin", genre: "software-engineering", addedBy: "admin" },
  { id: 2, title: "The Pragmatic Programmer", author: "David Thomas & Andrew Hunt", genre: "software-engineering", addedBy: "admin" },
  { id: 3, title: "Designing Data-Intensive Applications", author: "Martin Kleppmann", genre: "systems", addedBy: "admin" },
  { id: 4, title: "You Don't Know JS", author: "Kyle Simpson", genre: "javascript", addedBy: "admin" },
  { id: 5, title: "The Web Application Hacker's Handbook", author: "Stuttard & Pinto", genre: "security", addedBy: "admin" },
];

let nextId = books.length + 1;

export function getAllBooks(): Book[] {
  return books;
}

export function getBookById(id: number): Book | undefined {
  return books.find((b) => b.id === id);
}

export function addBook(title: string, author: string, genre: string, addedBy: string): Book {
  const book: Book = { id: nextId++, title, author, genre, addedBy };
  books.push(book);
  return book;
}

export function deleteBook(id: number): boolean {
  const index = books.findIndex((b) => b.id === id);
  if (index === -1) return false;
  books.splice(index, 1);
  return true;
}
