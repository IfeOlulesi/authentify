import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "../../shared/types";

// Session Auth — unlike Basic Auth, credentials are only sent once (at login).
// After that, the server hands the client a session ID in a cookie.
// The session ID maps to user data stored on the server (MemoryStore/Redis).
//
// This middleware checks that an active session exists on incoming requests.

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  // TODO: check if req.session.user exists
  // TODO: if not -> 401
  // TODO: if yes -> hydrate req.user from the session, call next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: same pattern as module 01
  };
}

// Tell TypeScript that req.session can hold a "user" property
declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
  }
}
