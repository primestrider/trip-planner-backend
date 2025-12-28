import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Inject
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import * as bcrypt from "bcrypt";
import { type RegisterUserDto } from "./auth.validation";
import { UsersService } from "../users/users.service";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthRepository } from "./auth.repository";
import { AccessTokenPayload, RegisterUserResponse } from "./models";
import { parseDuration } from "src/utils/parser";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private signJwt(
    payload: AccessTokenPayload,
    options: JwtSignOptions
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.jwtService.signAsync(payload, options);
  }

  async register(request: RegisterUserDto): Promise<RegisterUserResponse> {
    const { username, password } = request;

    this.logger.info("Register user requested", { username });

    try {
      await this.usersService.ensureUsernameNotExists(username);

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await this.usersService.create({
        username,
        password: passwordHash
      });

      const payload: AccessTokenPayload = {
        sub: user.id,
        username: user.username
      };

      const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET");
      const refreshSecret =
        this.configService.get<string>("JWT_REFRESH_SECRET");
      const accessExpiresIn = this.configService.get<string>(
        "JWT_ACCESS_EXPIRES_IN"
      );
      const refreshExpiresIn = this.configService.get<string>(
        "JWT_REFRESH_EXPIRES_IN"
      );

      if (
        !accessSecret ||
        !refreshSecret ||
        !accessExpiresIn ||
        !refreshExpiresIn
      ) {
        throw new InternalServerErrorException("JWT configuration is missing");
      }

      const accessExpiresMs = parseDuration(accessExpiresIn);
      const refreshExpiresMs = parseDuration(refreshExpiresIn);

      if (
        typeof accessExpiresMs !== "number" ||
        typeof refreshExpiresMs !== "number"
      ) {
        throw new InternalServerErrorException("Invalid JWT expiration format");
      }

      const accessToken = await this.signJwt(payload, {
        secret: accessSecret,
        expiresIn: Math.floor(accessExpiresMs / 1000)
      });

      const refreshToken = await this.signJwt(payload, {
        secret: refreshSecret,
        expiresIn: Math.floor(refreshExpiresMs / 1000)
      });

      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      const refreshExpiresAt = new Date(Date.now() + refreshExpiresMs);

      await this.authRepository.create({
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt
      });

      this.logger.info("User registered successfully", {
        userId: user.id,
        username: user.username
      });

      return {
        user: {
          id: user.id,
          username: user.username
        },
        accessToken,
        refreshToken
      } as RegisterUserResponse;
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        this.logger.warn("User registration conflict", { username });
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logger.error("User registration failed", {
        username,
        error: errorMessage
      });

      throw new InternalServerErrorException("Failed to register user");
    }
  }
}
