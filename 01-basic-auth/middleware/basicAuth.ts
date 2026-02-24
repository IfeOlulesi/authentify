import { Request, Response, NextFunction } from "express";
import { findUserByUsername, verifyPassword } from "../../shared/data/users";

// HTTP Basic Auth:
//   Client sends -> Authorization: Basic <base64(username:password)>
//   Server decodes, verifies, attaches user to req, calls next()
//   On failure -> 401 with WWW-Authenticate header

export async function basicAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // TODO: read the Authorization header
  // TODO: check it starts with "Basic "
  // TODO: decode the base64 credentials
  // TODO: split into username and password
  // TODO: look up the user
  // TODO: verify the password
  // TODO: attach req.user and call next()
}

// Runs AFTER basicAuth — checks req.user.role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO
  };
}
