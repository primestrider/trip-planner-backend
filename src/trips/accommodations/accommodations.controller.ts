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
import { AccommodationsService } from "./accommodations.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import {
  type CreateAccommodationDto,
  type UpdateAccommodationDto,
  CreateAccommodationSchema,
  UpdateAccommodationSchema
} from "./accommodations.validation";
import { type AccommodationResponse } from "./models";

@Controller("trips/:tripId/accommodations")
@UseGuards(AccessTokenGuard)
export class AccommodationsController {
  constructor(private readonly accommodationsService: AccommodationsService) {}

  /**
   * List accommodations of a trip
   *  GET /trips/:tripId/accommodations
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<AccommodationResponse[]> {
    return this.accommodationsService.list(userId, tripId);
  }

  /**
   * Get accommodation detail
   *  GET /trips/:tripId/accommodations/:id
   */
  @Get(":id")
  async findOne(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) accommodationId: string
  ): Promise<AccommodationResponse> {
    return this.accommodationsService.findOne(userId, tripId, accommodationId);
  }

  /**
   * Add an accommodation
   *  POST /trips/:tripId/accommodations
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body(ValidationPipe(CreateAccommodationSchema))
    body: CreateAccommodationDto
  ): Promise<AccommodationResponse> {
    return this.accommodationsService.create(userId, tripId, body);
  }

  /**
   * Update an accommodation
   *  PATCH /trips/:tripId/accommodations/:id
   */
  @Patch(":id")
  async update(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) accommodationId: string,
    @Body(ValidationPipe(UpdateAccommodationSchema))
    body: UpdateAccommodationDto
  ): Promise<AccommodationResponse> {
    return this.accommodationsService.update(
      userId,
      tripId,
      accommodationId,
      body
    );
  }

  /**
   * Delete an accommodation
   *  DELETE /trips/:tripId/accommodations/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) accommodationId: string
  ): Promise<null> {
    await this.accommodationsService.remove(userId, tripId, accommodationId);
    return null;
  }
}
