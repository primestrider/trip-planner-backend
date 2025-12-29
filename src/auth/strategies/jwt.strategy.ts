// auth/strategies/jwt-access.strategy.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtAccessPayload } from "../models";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  "jwt-access"
) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>("JWT_ACCESS_SECRET");

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is not defined");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret
    });
  }

  validate(payload: JwtAccessPayload) {
    /**
     * payload:
     * {
     *   sub: userId,
     *   role: "USER",
     *   iat,
     *   exp
     * }
     */
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    return payload; // attach ke req.user
  }
}
