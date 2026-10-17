import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtAccessStrategy } from "./jwt.strategy";
import { UsersService } from "src/users/users.service";

const usersService = { findActiveById: jest.fn() };
const config = { get: () => "x".repeat(32) };

const strategy = new JwtAccessStrategy(
  config as unknown as ConfigService,
  usersService as unknown as UsersService
);

// token issued at 2026-11-30T10:00:00Z
const ISSUED_AT = Date.UTC(2026, 10, 30, 10, 0, 0) / 1000;
const payload = {
  sub: "u1",
  username: "john",
  iat: ISSUED_AT,
  exp: ISSUED_AT + 3600
};

describe("JwtAccessStrategy", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should accept a token of an active user", async () => {
    usersService.findActiveById.mockResolvedValue({ passwordChangedAt: null });

    await expect(strategy.validate(payload)).resolves.toEqual({
      sub: "u1",
      username: "john"
    });
  });

  it("should reject tokens of deleted or inactive users", async () => {
    usersService.findActiveById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("should reject tokens issued before the password changed", async () => {
    usersService.findActiveById.mockResolvedValue({
      passwordChangedAt: new Date((ISSUED_AT + 1) * 1000)
    });

    await expect(strategy.validate(payload)).rejects.toThrow(
      "Password was changed"
    );
  });

  it("should accept tokens issued in the same second as the change", async () => {
    // the new token pair is issued right after the change
    usersService.findActiveById.mockResolvedValue({
      passwordChangedAt: new Date(ISSUED_AT * 1000)
    });

    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: "u1"
    });
  });
});
