import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "../../shared/types";

// ─────────────────────────────────────────────────────────────────────────────
// HOW SESSION AUTH WORKS AT THE MIDDLEWARE LEVEL
//
// After a successful login, express-session stores the user object in its
// server-side session store (MemoryStore in dev, Redis in prod) and sends
// the client a cookie containing only the session ID — a random opaque string
// like: connect.sid=s%3Axyz123...
//
// On every subsequent request, the browser automatically attaches that cookie.
// This middleware's job is simple: look up the session by that ID, check if
// a user was stored there, and either gate the request or let it through.
//
// The password never travels over the wire again after the initial login.
// ─────────────────────────────────────────────────────────────────────────────

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  // express-session has already run by this point (it's registered as app-level
  // middleware in server.ts before any routes). It read the connect.sid cookie,
  // looked up the corresponding session in the store, and populated req.session.
  //
  // If no valid cookie was sent, or the session has expired/been destroyed,
  // req.session.user will simply be undefined.

  if (!req.session.user) {
    // 401 Unauthorized — the request lacks valid authentication credentials.
    // We don't send a WWW-Authenticate header here (that's a Basic Auth
    // convention for triggering browser prompts). For session auth, a 401
    // just means "you need to log in at POST /login first."
    res.status(401).json({ error: "Unauthorized", message: "No active session. Please log in." });
    return;
  }

  // Hydrate req.user from the session so route handlers can access the current
  // user via req.user — without needing to know how authentication works.
  // This is the same interface every module uses: routes just read req.user
  // and the auth mechanism is completely transparent to them.
  req.user = req.session.user;

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// requireRole — middleware factory for role-based access control (RBAC)
//
// Runs AFTER requireSession, so by the time it executes, req.user is
// guaranteed to be populated. It answers a different question than requireSession:
//   requireSession: "are you authenticated?"   (identity)
//   requireRole:    "are you authorised?"       (permission)
//
// Usage in routes:
//   app.post("/books", requireSession, requireRole("admin"), handler)
//
// Keeping them separate means routes can mix and match:
//   - requireSession alone  -> any logged-in user
//   - requireSession + requireRole("admin") -> admin only
// ─────────────────────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  // This is the "middleware factory" pattern: calling requireRole("admin")
  // returns a brand new middleware function configured for that specific role.
  // The roles array is captured in the closure so each returned middleware
  // knows exactly what it's checking.
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Belt-and-suspenders: this shouldn't be reachable if requireSession ran
      // first, but we guard anyway in case someone wires up requireRole alone.
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      // 403 Forbidden — we know WHO you are (authenticated), but you don't
      // have permission for THIS action. This is the key 401 vs 403 distinction:
      //   401: I don't know who you are — go identify yourself
      //   403: I know exactly who you are — and the answer is still no
      res.status(403).json({
        error: "Forbidden",
        message: `Requires role: ${roles.join(" or ")}`,
      });
      return;
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript module augmentation
//
// express-session ships with a SessionData interface that's intentionally left
// open (it has no user property by default). We extend it here to tell
// TypeScript that req.session.user is a valid field, typed as AuthenticatedUser.
//
// Without this, TS would error: "Property 'user' does not exist on type
// 'SessionData'" even though it works fine at runtime.
//
// The declare module block doesn't generate any JavaScript — it's purely
// a compile-time hint that merges our addition into express-session's types.
// ─────────────────────────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
  }
}
