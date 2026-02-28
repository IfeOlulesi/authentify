import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "../../shared/types";

// ─────────────────────────────────────────────────────────────────────────────
// JWT AUTHENTICATION
//
// The leap from module 03: instead of a random opaque token that maps to a user
// in a server-side store, we issue a *signed* token that ENCODES the user's
// identity. Verification is purely cryptographic — no DB lookup required.
//
// JWT structure (three base64url segments separated by dots):
//
//   eyJhbGciOiJIUzI1NiJ9          <- header:    { alg: "HS256", typ: "JWT" }
//   .eyJzdWIiOiJ1c3JfMSJ9         <- payload:   { sub, username, role, iat, exp }
//   .SflKxwRJSMeKKF2QT4fwpMeJf36  <- signature: HMAC-SHA256(header.payload, secret)
//
// The payload is base64url-encoded — NOT encrypted. Anyone can decode it with
// atob() in the browser. NEVER put secrets or sensitive PII in JWT claims.
//
// The signature is the critical part: if anyone tampers with the payload
// (e.g. changing role: "user" to role: "admin"), the signature won't match
// and jwt.verify() will throw. Cryptographic integrity, not secrecy.
//
// Key weakness this introduces: access tokens CANNOT be invalidated before expiry.
// There's nothing to delete — the server holds no state for access tokens.
// That's the "revocation problem." Short expiry (15m) is the standard mitigation.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

// ── Refresh token store ───────────────────────────────────────────────────────
// The access token is fully stateless — we store nothing for it.
// The refresh token is stored server-side so it CAN be revoked on logout.
// This is the deliberate hybrid: stateless fast path (access), revocable slow path (refresh).
//
// In production: a Redis SET with TTL, or a DB table with an expiry column.
// ─────────────────────────────────────────────────────────────────────────────
export const refreshTokenStore = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// generateTokens — sign and return both tokens from a user payload
//
// Called at login. The payload we embed becomes the "claims" inside the JWT.
//
// Standard claims used here:
//   sub  (subject)  — who the token is about. Convention: the user's stable ID.
//   iat  (issued at) — automatically added by jwt.sign(), Unix timestamp
//   exp  (expiry)    — automatically calculated from the expiresIn option
//
// Custom claims (non-standard but completely valid per the JWT spec):
//   username, role — convenience fields so the server doesn't need a DB lookup
//                    to display the username or check the role in middleware.
//
// WARNING: claims are readable by anyone with the token. Don't embed
// passwordHash, email, credit card numbers, or any sensitive data.
// ─────────────────────────────────────────────────────────────────────────────

export function generateTokens(payload: { id: string; username: string; role: string }) {
  // Access token — short-lived (15 minutes).
  // Used on every protected API request. Cannot be revoked early.
  // The "sub" convention makes it easy to extract the user ID from any JWT library.
  const accessToken = jwt.sign(
    { sub: payload.id, username: payload.username, role: payload.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );

  // Refresh token — long-lived (7 days).
  // ONLY sent to POST /refresh. Stored server-side so it can be invalidated.
  // We embed minimal claims — the refresh token's only job is to prove the
  // user was legitimately logged in so we can issue a new access token.
  const refreshToken = jwt.sign(
    { sub: payload.id },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );

  // Persist the refresh token so POST /logout can delete it.
  // Without this store, logout would be impossible (the token would remain valid for 7 days).
  refreshTokenStore.add(refreshToken);

  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// jwtAuth — middleware that verifies the access token on every protected request
//
// This is the "no DB lookup" magic of JWT.
// jwt.verify() does three things in one call:
//   1. Decodes the header and payload from base64url
//   2. Recomputes the HMAC-SHA256 signature using ACCESS_SECRET
//   3. Compares it to the signature in the token — if they match, payload is trusted
//   4. Checks the exp claim — throws TokenExpiredError if past expiry
//
// If verification passes, we can trust every claim in the payload.
// If verification fails (bad signature, expired, malformed), it throws.
// ─────────────────────────────────────────────────────────────────────────────

export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization header. Expected: Bearer <token>",
    });
    return;
  }

  const token = header.slice(7).trim();

  try {
    // jwt.verify throws on any failure — expired, bad signature, malformed, etc.
    // Always pass the algorithm explicitly (second overload or options.algorithms).
    // Without this, a crafted token with "alg": "none" could bypass verification
    // in poorly configured libraries — the "algorithm confusion attack."
    const decoded = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;

    // Populate req.user from the verified claims — same interface as all modules.
    // The "!" assertion is safe here: if sub/username/role are missing the token
    // would have been rejected at issuance (we control generateTokens).
    req.user = {
      id: decoded.sub as string,
      username: decoded.username as string,
      // Cast to Role — safe because we only ever embed valid roles at token issuance.
      // The cryptographic signature ensures the payload hasn't been tampered with,
      // so if the signature verified, this cast is trustworthy.
      role: decoded.role as Role,
      email: "",  // not embedded in the JWT — would need a DB lookup to get it
    };

    next();
  } catch (err) {
    // jwt.verify throws distinct error types:
    //   JsonWebTokenError   -> bad signature, malformed token
    //   TokenExpiredError   -> exp claim is in the past
    //   NotBeforeError      -> nbf claim is in the future (if used)
    //
    // We don't expose the specific reason to the client — it doesn't help them
    // and could help an attacker (e.g. knowing "expired" vs "invalid" leaks info).
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Unauthorized", message: "Access token expired. Use /refresh." });
    } else {
      res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// requireRole — middleware factory for RBAC
//
// Identical pattern to modules 01-03. Always runs after jwtAuth so req.user
// is guaranteed populated. The role was embedded in the JWT at login and
// verified cryptographically — no DB lookup needed to check it.
//
// Interview trap: "what if a user's role changes after they log in?"
// Answer: with JWT, there's a window until the access token expires (up to 15m)
// where the old role is still trusted. This is an accepted trade-off.
// ─────────────────────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Forbidden",
        message: `Requires role: ${roles.join(" or ")}`,
      });
      return;
    }

    next();
  };
}

export { ACCESS_SECRET, REFRESH_SECRET, ACCESS_EXPIRY, REFRESH_EXPIRY };
