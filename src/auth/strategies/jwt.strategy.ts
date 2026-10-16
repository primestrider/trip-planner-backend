// auth/strategies/jwt-access.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AccessTokenPayload, JwtAccessPayload } from "../models";
import { UsersService } from "src/users/users.service";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  "jwt-access"
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    const secret = configService.get<string>("JWT_ACCESS_SECRET");

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is not defined");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret
    });
  }

  /**
   * Runs after the signature and expiry are verified.
   *
   * JWTs are stateless, so on their own they stay valid until they expire.
   * Checking the user here lets the API reject tokens right away when the
   * account is deleted or deactivated, or the password changed after the
   * token was issued. The cost is one primary-key lookup per request.
   *
   * @returns the payload attached to `request.user`
   * @throws UnauthorizedException
   */
  async validate(payload: JwtAccessPayload): Promise<AccessTokenPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findActiveById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("Account is no longer active");
    }

    if (
      user.passwordChangedAt &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException(
        "Password was changed; please sign in again"
      );
    }

    return { sub: payload.sub, username: payload.username };
  }
}
