import {
  Body,
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
import { ShareService } from "./share.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { SkipDeviceId } from "src/common/decorator/skip-device-id.decorator";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import { type EnableShareDto, EnableShareSchema } from "./share.validation";
import { type PublicTripResponse, type ShareLinkResponse } from "./models";

/**
 * Share link managed by the trip owner
 */
@Controller("trips/:tripId/share")
@UseGuards(AccessTokenGuard)
export class TripShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * Current share link (owner only)
   *  GET /trips/:tripId/share
   */
  @Get()
  async getLink(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<ShareLinkResponse> {
    return this.shareService.getLink(userId, tripId);
  }

  /**
   * Turn on the share link, or replace it with { "regenerate": true }
   *  POST /trips/:tripId/share
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async enable(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body(ValidationPipe(EnableShareSchema)) body: EnableShareDto
  ): Promise<ShareLinkResponse> {
    return this.shareService.enable(userId, tripId, body);
  }

  /**
   * Turn off the share link (owner only)
   *  DELETE /trips/:tripId/share
   */
  @Delete()
  async disable(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<ShareLinkResponse> {
    return this.shareService.disable(userId, tripId);
  }
}

/**
 * Public read-only trip page: no login or device id needed.
 * Still covered by the global rate limit.
 */
@Controller("shared")
@SkipDeviceId()
export class SharedTripController {
  constructor(private readonly shareService: ShareService) {}

  /**
   *  GET /shared/:token
   */
  @Get(":token")
  async getPublicTrip(
    @Param("token") token: string
  ): Promise<PublicTripResponse> {
    return this.shareService.getPublicTrip(token);
  }
}
