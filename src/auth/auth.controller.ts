import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import {
  type RegisterUserDto,
  type LoginUserDto,
  LoginSchema,
  RegisterSchema
} from "./auth.validation";

import { type AuthUserResponse, type LogoutType } from "./models";
import { CurrentDevice } from "src/common/decorator/device.decorator";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { AccessTokenGuard } from "./guards/access-token.guard";

@Controller("authentication")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register as a new user
   * POST /authentication/register
   * @param body
   * @param deviceId
   * @returns
   */
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(ValidationPipe(RegisterSchema)) body: RegisterUserDto,
    @CurrentDevice() deviceId: string
  ): Promise<AuthUserResponse> {
    const response = await this.authService.register({ ...body, deviceId });
    return response;
  }

  /**
   * Login as a user
   *  POST /authentication/login
   */
  @Post("login")
  async login(
    @Body(ValidationPipe(LoginSchema)) body: LoginUserDto,
    @CurrentDevice() deviceId: string
  ): Promise<AuthUserResponse> {
    const response = await this.authService.login({ ...body, deviceId });
    return response;
  }

  /**
   * Refresh authentication tokens.
   *
   * POST /authentication/refresh-token
   * This endpoint is protected by RefreshTokenGuard.
   * The refresh token is validated before reaching this handler.

   * @param req
   * @param deviceId
   * @param refreshToken
   * @returns
   */
  @UseGuards(RefreshTokenGuard)
  @Post("/refresh-token")
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @CurrentUser("sub") userId: string,
    @CurrentDevice() deviceId: string,
    @Body("refreshToken") refreshToken: string
  ): Promise<AuthUserResponse> {
    const response = await this.authService.refreshToken(
      userId,
      deviceId,
      refreshToken
    );

    return response;
  }

  /**
   * Logout user
   *  POST /authentication/logout
   * @param userId
   * @param deviceId
   * @param type
   * @returns
   */
  @Post("logout")
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser("sub") userId: string,
    @CurrentDevice() deviceId: string,
    @Body("type") type?: LogoutType
  ): Promise<null> {
    await this.authService.logout(userId, deviceId, type);
    return null;
  }
}
