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
import { BaseResponse } from "src/common/models";
import { AuthUserResponse } from "./models";
import { CurrentDevice } from "src/common/decorator/device.decorator";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";

@Controller("authentication")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user.
   *
   * POST /authentication/register
   */
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(ValidationPipe(RegisterSchema)) body: RegisterUserDto,
    @CurrentDevice() deviceId: string
  ): Promise<BaseResponse<AuthUserResponse>> {
    const result = await this.authService.register({ ...body, deviceId });
    return {
      data: result
    };
  }

  /**
   * Login as a user
   *  POST /authentication/login
   */
  @Post("login")
  async login(
    @Body(ValidationPipe(LoginSchema)) body: LoginUserDto,
    @CurrentDevice() deviceId: string
  ): Promise<BaseResponse<AuthUserResponse>> {
    const result = await this.authService.login({ ...body, deviceId });
    return {
      data: result
    };
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
  ): Promise<BaseResponse<AuthUserResponse>> {
    const result = await this.authService.refreshToken(
      userId,
      deviceId,
      refreshToken
    );

    return {
      data: result
    };
  }
}
