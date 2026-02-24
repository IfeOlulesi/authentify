import { Request, Response, NextFunction } from "express";
import { findUserByUsername, verifyPassword } from "../../shared/data/users";

// HTTP Basic Auth:
//   Client sends -> Authorization: Basic <base64(username:password)>
//   Server decodes, verifies, attaches user to req, calls next()
//   On failure -> 401 with WWW-Authenticate header

export async function basicAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  // Check header exists and starts with "Basic "
  if (!header || !header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Authentify"');
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
    return;
  }

  // Decode the base64 credentials
  const encoded = header.slice("Basic ".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  // decoded = "alice:password123"

  const [username, password] = decoded.split(":");

  // Look up the user
  const user = findUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  // Verify the password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  // Attach user to req so route handlers can use it
  req.user = { id: user.id, username: user.username, email: user.email, role: user.role };

  next();
}

// Runs AFTER basicAuth — checks req.user.role
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: `Requires role: ${roles.join(" or ")}` });
      return;
    }

    next();
  };
}
