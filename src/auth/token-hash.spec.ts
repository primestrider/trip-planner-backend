import { hashRefreshToken, refreshTokenMatches } from "./token-hash";

// two JWTs of the same user: identical for far more than 72 bytes
const prefix = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." + "a".repeat(120);
const oldToken = `${prefix}.old-signature`;
const newToken = `${prefix}.new-signature`;

describe("refresh token hashing", () => {
  it("should tell apart tokens that share a long prefix", () => {
    const stored = hashRefreshToken(newToken);

    expect(refreshTokenMatches(newToken, stored)).toBe(true);
    expect(refreshTokenMatches(oldToken, stored)).toBe(false);
  });

  it("should never match hashes from the old bcrypt scheme", () => {
    const bcryptHash =
      "$2b$10$abcdefghijklmnopqrstuuJ9h3F1o2CkvCw4CqkI5n1JkK9m2y7uS";

    expect(refreshTokenMatches(newToken, bcryptHash)).toBe(false);
  });
});
