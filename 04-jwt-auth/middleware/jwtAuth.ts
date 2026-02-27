import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// JWT Authentication
//
// The big leap from module 03: the server no longer stores anything.
// Instead of a random token it looks up in a DB, it issues a *signed* token.
// Verification is purely cryptographic — no DB round-trip needed.
//
// JWT structure: header.payload.signature
//   header    -> { alg: "HS256", typ: "JWT" }
//   payload   -> { sub: "usr_1", username: "alice", role: "user", iat: ..., exp: ... }
//   signature -> HMAC-SHA256(base64(header) + "." + base64(payload), secret)
//
// The server can verify the token is untampered by re-computing the signature.
// If someone modifies the payload, the signature won't match -> rejected.
//
// Key weakness: tokens can't be invalidated before they expire.
// That's why short expiry (15m) + refresh tokens are the standard pattern.

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

// Refresh token store — in production this would be a DB/Redis
// We store them here so we can invalidate them on logout
export const refreshTokenStore = new Set<string>();

export function generateTokens(payload: { id: string; username: string; role: string }) {
  // TODO: use jwt.sign() to generate an access token (short-lived)
  // TODO: use jwt.sign() to generate a refresh token (long-lived)
  // TODO: store the refresh token in refreshTokenStore
  // TODO: return { accessToken, refreshToken }
}

export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  // TODO: check header exists and starts with "Bearer "
  // TODO: extract the token
  // TODO: verify with jwt.verify(token, ACCESS_SECRET)
  //       wrap in try/catch — jwt.verify throws on invalid/expired tokens
  // TODO: attach req.user from the decoded payload, call next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: same pattern as previous modules
  };
}

export { ACCESS_SECRET, REFRESH_SECRET, ACCESS_EXPIRY, REFRESH_EXPIRY };
