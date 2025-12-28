import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import { type RegisterUserDto, RegisterSchema } from "./auth.validation";
import { BaseResponse } from "src/common/models";
import { RegisterUserResponse } from "./models";

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
    @Body(ValidationPipe(RegisterSchema)) body: RegisterUserDto
  ): Promise<BaseResponse<RegisterUserResponse>> {
    const result = await this.authService.register(body);

    return {
      data: result
    };
  }
}
