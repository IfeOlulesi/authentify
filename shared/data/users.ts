import bcrypt from "bcryptjs";
import { User } from "../types";

// Plain-text passwords for testing:
//   alice  -> "password123"  (role: user)
//   bob    -> "letmein"      (role: user)
//   admin  -> "admin-secret" (role: admin)

export const users: User[] = [
  {
    id: "usr_1",
    username: "alice",
    email: "alice@example.com",
    passwordHash: bcrypt.hashSync("password123", 10),
    role: "user",
    tokens: [],
  },
  {
    id: "usr_2",
    username: "bob",
    email: "bob@example.com",
    passwordHash: bcrypt.hashSync("letmein", 10),
    role: "user",
    tokens: [],
  },
  {
    id: "usr_3",
    username: "admin",
    email: "admin@example.com",
    passwordHash: bcrypt.hashSync("admin-secret", 10),
    role: "admin",
    tokens: [],
  },
];

export function findUserByUsername(username: string): User | undefined {
  // TODO
}

export function findUserById(id: string): User | undefined {
  // TODO
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  // TODO
}
