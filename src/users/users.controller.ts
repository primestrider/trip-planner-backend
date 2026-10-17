import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodBody } from "src/common/validation/zod.decorators";
import { UsersService } from "./users.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type DeleteAccountDto,
  type UpdateProfileDto,
  DeleteAccountSchema,
  UpdateProfileSchema
} from "./users.validation";
import { type AvatarResponse, type UserProfileResponse } from "./models";

@ApiTags("users")
@Controller("users")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get profile of the authenticated user
   *  GET /users/profile
   */
  @Get("profile")
  async getProfile(
    @CurrentUser("sub") userId: string
  ): Promise<UserProfileResponse> {
    return this.usersService.getProfile(userId);
  }

  /**
   * Update name and/or avatar of the authenticated user
   *  PATCH /users/profile
   */
  @Patch("profile")
  async updateProfile(
    @CurrentUser("sub") userId: string,
    @ZodBody(UpdateProfileSchema) body: UpdateProfileDto
  ): Promise<UserProfileResponse> {
    return this.usersService.updateProfile(userId, body);
  }

  /**
   * List avatars that can be selected for the profile
   *  GET /users/avatars
   */
  @Get("avatars")
  async getAvatars(): Promise<AvatarResponse[]> {
    return this.usersService.getAvatars();
  }

  /**
   * Delete the authenticated user's account (password required)
   *  DELETE /users/profile
   */
  @Delete("profile")
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser("sub") userId: string,
    @ZodBody(DeleteAccountSchema) body: DeleteAccountDto
  ): Promise<null> {
    await this.usersService.deleteAccount(userId, body.password);
    return null;
  }
}
