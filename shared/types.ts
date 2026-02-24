export type Role = "user" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  tokens: string[];
  oauthAccounts?: OAuthAccount[];
}

export interface OAuthAccount {
  provider: "github" | "google" | "mock-idp";
  providerId: string;
  accessToken?: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  addedBy: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
