import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodBody } from "src/common/validation/zod.decorators";
import { InvitesService } from "./invites.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { type CreateInviteDto, CreateInviteSchema } from "./invites.validation";
import {
  type AcceptInviteResponse,
  type CreatedInviteResponse,
  type InvitePreviewResponse,
  type InviteResponse
} from "./models";

/**
 * Invite links managed by the trip owner
 */
@ApiTags("invites")
@Controller("trips/:tripId/invites")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class TripInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Create an invite link (owner only). The token is returned only once.
   *  POST /trips/:tripId/invites
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodBody(CreateInviteSchema) body: CreateInviteDto
  ): Promise<CreatedInviteResponse> {
    return this.invitesService.create(userId, tripId, body);
  }

  /**
   * List invite links (owner only)
   *  GET /trips/:tripId/invites
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<InviteResponse[]> {
    return this.invitesService.list(userId, tripId);
  }

  /**
   * Revoke an invite link (owner only)
   *  DELETE /trips/:tripId/invites/:inviteId
   */
  @Delete(":inviteId")
  async revoke(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("inviteId", ParseUUIDPipe) inviteId: string
  ): Promise<InviteResponse> {
    return this.invitesService.revoke(userId, tripId, inviteId);
  }
}

/**
 * Invite links opened by the invited user
 */
@ApiTags("invites")
@Controller("invites")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Preview the trip behind an invite link
   *  GET /invites/:token
   */
  @Get(":token")
  async preview(
    @CurrentUser("sub") userId: string,
    @Param("token") token: string
  ): Promise<InvitePreviewResponse> {
    return this.invitesService.preview(userId, token);
  }

  /**
   * Join the trip through an invite link
   *  POST /invites/:token/accept
   */
  @Post(":token/accept")
  @HttpCode(HttpStatus.OK)
  async accept(
    @CurrentUser("sub") userId: string,
    @Param("token") token: string
  ): Promise<AcceptInviteResponse> {
    return this.invitesService.accept(userId, token);
  }
}
