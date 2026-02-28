import { Request, Response, NextFunction } from "express";
import { users } from "../../shared/data/users";

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN-BASED AUTHENTICATION (Opaque Bearer Tokens)
//
// How it works:
//   1. Client POSTs credentials to /login
//   2. Server generates a UUID, pushes it into user.tokens[], returns it
//   3. Client stores the token (localStorage, memory, etc.) — it's their problem now
//   4. Client sends: Authorization: Bearer <uuid> on every protected request
//   5. THIS middleware extracts that token and scans the user store to find its owner
//   6. On logout, the token is removed from user.tokens[] — immediately worthless
//
// Key insight: the token itself is "opaque" — it's just a random string.
// It carries NO information about who the user is. The server must do a lookup
// on every single request to map token -> user. That's the central cost.
//
// This is the conceptual bridge between sessions (server-managed cookies) and
// JWTs (self-describing, cryptographically signed tokens).
// ─────────────────────────────────────────────────────────────────────────────

export function tokenAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  // The Authorization header must exist and follow the Bearer scheme.
  // RFC 6750 defines Bearer token usage: "Authorization: Bearer <token>"
  // "Bearer" literally means "whoever holds this token is granted access."
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization header. Expected: Bearer <token>",
    });
    return;
  }

  // Everything after "Bearer " (7 characters) is the token itself.
  // trim() handles any accidental trailing whitespace.
  const token = header.slice(7).trim();

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Token is empty" });
    return;
  }

  // ── TOKEN LOOKUP ───────────────────────────────────────────────────────────
  // This is the core cost of opaque tokens: a lookup on every request.
  //
  // In production this would be:
  //   SELECT * FROM users WHERE token = $1   (PostgreSQL)
  //   GET token:<token>                       (Redis, O(1) key lookup)
  //
  // Here we do a linear scan — O(n×m) over users × tokens per user.
  // In dev with 3 users it's instant. At scale, it's a bottleneck.
  //
  // This is exactly the problem JWT solves: no lookup needed, verification
  // is purely cryptographic. That trade-off is the central lesson of module 04.
  // ──────────────────────────────────────────────────────────────────────────
  const user = users.find(u => u.tokens.includes(token));

  if (!user) {
    // The token wasn't found in any user's token list.
    // Could be: never existed, already logged out, or just garbage.
    // We don't distinguish — all of those are 401.
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  // Hydrate req.user so route handlers can access the current user without
  // knowing how auth works. Same interface as all other modules — swap the
  // middleware, keep the routes unchanged.
  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// requireRole — middleware factory for role-based access control (RBAC)
//
// Identical pattern to module 01 and 02. Always runs AFTER tokenAuth so
// req.user is guaranteed populated before this function checks it.
//
// Separation of concerns:
//   tokenAuth     -> "are you authenticated?" (identity verification)
//   requireRole   -> "are you authorised?"    (permission check)
// ─────────────────────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  // Middleware factory: calling requireRole("admin") returns a new function
  // that closes over the `roles` array. Each call creates an independent
  // middleware configured for that specific permission level.
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Defensive guard — shouldn't be reachable if tokenAuth ran first.
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      // 403 Forbidden: we know who you are, the answer is still no.
      // 401 would be wrong here — we're not asking for credentials, we're
      // denying a known user permission for this specific resource.
      res.status(403).json({
        error: "Forbidden",
        message: `Requires role: ${roles.join(" or ")}`,
      });
      return;
    }

    next();
  };
}
