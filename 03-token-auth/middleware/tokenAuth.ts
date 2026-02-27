import { Request, Response, NextFunction } from "express";
import { users } from "../../shared/data/users";

// Token-Based Authentication
//
// Similar to sessions but the token lives on the client (not the server store).
// The server still has to look up the token on every request though —
// that's the key weakness this sets up for JWT (module 04) to solve.
//
// Flow:
//   POST /login  -> server generates a UUID token, stores it on the user record,
//                   returns it to the client
//   GET  /books  -> client sends: Authorization: Bearer <token>
//                   server looks up which user owns that token -> grants access
//   POST /logout -> server deletes the token from its store -> token is worthless

// Token store — in production this would be a DB column/Redis key
// Here we reuse the `tokens` array on each User in the shared users store

export function tokenAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  // TODO: check header exists and starts with "Bearer "
  // TODO: extract the token (everything after "Bearer ")
  // TODO: search the users store for a user whose tokens array includes this token
  //       Hint: users.find(u => u.tokens.includes(token))
  // TODO: if not found -> 401
  // TODO: attach req.user and call next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: same pattern as previous modules
  };
}
