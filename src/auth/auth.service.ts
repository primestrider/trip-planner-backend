import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Inject,
  UnauthorizedException,
  BadRequestException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthRepository } from "./auth.repository";

import {
  AccessTokenPayload,
  AuthUserResponse,
  LoginContext,
  LogoutType,
  RegisterContext
} from "./models";
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

  /**
   * Load and validate JWT configuration from environment variables.
   *
   * @returns Object containing JWT secrets and expiration durations in milliseconds
   * @throws {InternalServerErrorException} If configuration is missing or invalid
   */
  private getJwtConfig(): {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresMs: number;
    refreshExpiresMs: number;
  } {
    const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET");
    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET");
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

    return {
      accessSecret,
      refreshSecret,
      accessExpiresMs,
      refreshExpiresMs
    };
  }

  /**
   * Sign a JWT using the given payload and signing options.
   *
   * @param payload Data to be embedded inside the JWT
   * @param options JWT signing options (secret, expiration, etc.)
   * @returns Signed JWT string
   */
  private async signJwt<T extends object>(
    payload: T,
    options: JwtSignOptions
  ): Promise<string> {
    return await this.jwtService.signAsync(payload, options);
  }

  /**
   * Generate a short-lived access token for authenticated API requests.
   *
   * @param payload JWT payload containing user identity
   * @returns Signed access token
   */
  private async generateAccessToken(
    payload: AccessTokenPayload
  ): Promise<string> {
    const { accessSecret, accessExpiresMs } = this.getJwtConfig();

    return this.signJwt(payload, {
      secret: accessSecret,
      expiresIn: Math.floor(accessExpiresMs / 1000)
    });
  }

  /**
   * Generate a long-lived refresh token and its expiration timestamp.
   *
   * @param payload JWT payload containing user identity
   * @returns Object containing refresh token and expiration date
   */
  private async generateRefreshToken(payload: AccessTokenPayload): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const { refreshSecret, refreshExpiresMs } = this.getJwtConfig();

    const token = await this.signJwt(payload, {
      secret: refreshSecret,
      expiresIn: Math.floor(refreshExpiresMs / 1000)
    });

    return {
      token,
      expiresAt: new Date(Date.now() + refreshExpiresMs)
    };
  }

  /**
   * Register a new user and issue access & refresh tokens.
   *
   * @param request User registration payload (username and password)
   * @returns Registered user data along with access and refresh tokens
   * @throws {ConflictException} If username already exists
   * @throws {InternalServerErrorException} If registration process fails
   * @returns {AuthUserResponse}
   */
  async register(request: RegisterContext): Promise<AuthUserResponse> {
    const { username, password, deviceId } = request;

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

      const accessToken = await this.generateAccessToken(payload);

      const { token: refreshToken, expiresAt: refreshExpiresAt } =
        await this.generateRefreshToken(payload);

      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

      await this.authRepository.create({
        userId: user.id,
        deviceId: deviceId,
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
      };
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

  /**
   * Login as a user and issue new access & refresh token
   * @param request LoginContext (username and password)
   * @throws {UnauthorizedException} if username or password invalid

  **/
  async login(request: LoginContext): Promise<AuthUserResponse> {
    this.logger.info("login user requested", { username: request.username });

    const { username, password, deviceId } = request;

    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username
    };

    const accessToken = await this.generateAccessToken(payload);
    const { token: refreshToken, expiresAt } =
      await this.generateRefreshToken(payload);

    // for overwrite token for same device
    await this.authRepository.deleteTokenByUserAndDevice(user.id, deviceId);

    await this.authRepository.create({
      userId: user.id,
      deviceId: deviceId,
      tokenHash: await bcrypt.hash(refreshToken, 10),
      expiresAt
    });

    return {
      user: { id: user.id, username: user.username },
      accessToken,
      refreshToken
    };
  }

  /**
   * Refresh authentication tokens for a user.
   *
   * This method validates the provided refresh token against
   * the stored hashed token, rotates the refresh token,
   * and issues a new access token.
   *
   * @param userId User identifier extracted from refresh token payload
   * @param deviceId Device identifier for session scoping
   * @param refreshToken Raw refresh token provided by client
   * @returns New access & refresh token pair with user info
   * @throws {UnauthorizedException} If refresh token is invalid or revoked
   */
  async refreshToken(
    userId: string,
    deviceId: string,
    refreshToken: string
  ): Promise<AuthUserResponse> {
    this.logger.info("refresh token user requested", { id: userId });

    // find refresh token in DB
    const tokenRecord = await this.authRepository.findByUserAndDevice(
      userId,
      deviceId
    );

    if (!tokenRecord) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // compare provided refreshToken with hased token from db
    const isTokenValid = await bcrypt.compare(
      refreshToken,
      tokenRecord.tokenHash
    );

    if (!isTokenValid) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // 3. Load user (for response consistency)
    const user = await this.usersService.findUserBydId(userId);

    const payload: AccessTokenPayload = {
      sub: user.id,
      username: user.username
    };

    // generate new token
    const accessToken = await this.generateAccessToken(payload);

    const { token: newRefreshToken, expiresAt } =
      await this.generateRefreshToken(payload);

    // update refresh token in db

    await this.authRepository.updateRefreshToken(
      tokenRecord.id,
      await bcrypt.hash(newRefreshToken, 10),
      expiresAt
    );

    return {
      user: {
        id: user.id,
        username: user.username
      },
      accessToken: accessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * Logout user in current devices or all devices
   * @param userId
   * @param deviceId
   * @param type
   */
  async logout(
    userId: string,
    deviceId: string,
    type: LogoutType = "current"
  ): Promise<void> {
    const resolvedType: LogoutType = type ?? "current";

    this.logger.info("logout user requested", {
      userId,
      deviceId,
      type
    });

    if (resolvedType !== "current" && resolvedType !== "all_devices") {
      throw new BadRequestException(
        "Invalid logout type. Allowed values: current, all_devices"
      );
    }

    if (resolvedType == "all_devices") {
      await this.authRepository.deleteAllTokenUser(userId);
    }

    if (resolvedType == "current") {
      await this.authRepository.deleteTokenByUserAndDevice(userId, deviceId);
    }
  }
}
