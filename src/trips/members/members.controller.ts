import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { MembersService } from "./members.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import {
  type AddMemberDto,
  type UpdateMemberDto,
  AddMemberSchema,
  UpdateMemberSchema
} from "./members.validation";
import { type TripMemberResponse } from "./models";

@Controller("trips/:tripId/members")
@UseGuards(AccessTokenGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * List owner and collaborators of a trip
   *  GET /trips/:tripId/members
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<TripMemberResponse[]> {
    return this.membersService.list(userId, tripId);
  }

  /**
   * Add a collaborator by username (owner only)
   *  POST /trips/:tripId/members
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body(ValidationPipe(AddMemberSchema)) body: AddMemberDto
  ): Promise<TripMemberResponse> {
    return this.membersService.add(userId, tripId, body);
  }

  /**
   * Change role of a collaborator (owner only)
   *  PATCH /trips/:tripId/members/:userId
   */
  @Patch(":userId")
  async updateRole(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("userId", ParseUUIDPipe) memberUserId: string,
    @Body(ValidationPipe(UpdateMemberSchema)) body: UpdateMemberDto
  ): Promise<TripMemberResponse> {
    return this.membersService.updateRole(userId, tripId, memberUserId, body);
  }

  /**
   * Remove a collaborator (owner), or leave the trip (yourself)
   *  DELETE /trips/:tripId/members/:userId
   */
  @Delete(":userId")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("userId", ParseUUIDPipe) memberUserId: string
  ): Promise<null> {
    await this.membersService.remove(userId, tripId, memberUserId);
    return null;
  }

  /**
   * Make a member the new owner (owner only).
   * The previous owner becomes an EDITOR.
   *  POST /trips/:tripId/members/:userId/transfer-ownership
   */
  @Post(":userId/transfer-ownership")
  @HttpCode(HttpStatus.OK)
  async transferOwnership(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("userId", ParseUUIDPipe) newOwnerId: string
  ): Promise<TripMemberResponse[]> {
    return this.membersService.transferOwnership(userId, tripId, newOwnerId);
  }
}
