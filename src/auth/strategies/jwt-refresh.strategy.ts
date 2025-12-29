import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

/**
 * Payload structure expected inside the JWT refresh token.
 */
export interface JwtRefreshPayload {
  /**
   * User identifier (usually the user ID).
   */
  sub: string;

  /**
   * User role or permission identifier.
   */
  role: string;
}

/**
 * JwtRefreshStrategy
 *
 * Passport strategy responsible for validating JWT refresh tokens.
 *
 * Responsibilities:
 * - Extract the refresh token from the request body
 * - Verify the token signature and expiration
 * - Attach the decoded payload to `request.user`
 *
 * This strategy is intended to be used ONLY for the
 * `/auth/refresh` endpoint.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh"
) {
  /**
   * Creates an instance of JwtRefreshStrategy.
   *
   * @param configService Service used to access environment variables
   * @throws Error if JWT_REFRESH_SECRET is not defined
   */
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>("JWT_REFRESH_SECRET");

    if (!secret) {
      throw new Error("JWT_REFRESH_SECRET is not defined");
    }

    super({
      /**
       * Extracts the refresh token from the request body.
       * Expected field name: `refreshToken`
       */
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),

      /**
       * Secret key used to verify the refresh token.
       * This must be different from the access token secret.
       */
      secretOrKey: secret
    });
  }

  /**
   * Validates the decoded refresh token payload.
   *
   * This method is called automatically after the token
   * has been successfully verified by Passport.
   *
   * The returned value will be attached to `request.user`
   * and made available to downstream handlers.
   *
   * @param payload Decoded JWT refresh token payload
   * @returns The validated payload to be attached to `request.user`
   * @throws UnauthorizedException if the payload is invalid
   */
  validate(payload: JwtRefreshPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return payload;
  }
}
