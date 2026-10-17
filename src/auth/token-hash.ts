import { createHash, timingSafeEqual } from "crypto";

/**
 * Hash a refresh token for storage.
 *
 * Refresh tokens are long random-looking JWTs, so a fast SHA-256 is enough
 * (slow hashes like bcrypt protect guessable human passwords). bcrypt must
 * NOT be used here: it only reads the first 72 bytes, and every JWT of a
 * user starts with the same header and `sub` / `username`, so all of that
 * user's refresh tokens would match the same hash and rotation would not
 * revoke anything.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compare a presented token with a stored hash in constant time.
 * Hashes from the previous bcrypt scheme never match, so those sessions
 * simply have to sign in again.
 */
export function refreshTokenMatches(
  token: string,
  storedHash: string
): boolean {
  const presented = Buffer.from(hashRefreshToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");

  return (
    stored.length === presented.length && timingSafeEqual(presented, stored)
  );
}
