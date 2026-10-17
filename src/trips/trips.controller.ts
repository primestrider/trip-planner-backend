import {
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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodBody, ZodQuery } from "src/common/validation/zod.decorators";
import { TripsService } from "./trips.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type CreateTripDto,
  type DuplicateTripDto,
  type ListTripsQuery,
  type UpdateTripDto,
  CreateTripSchema,
  DuplicateTripSchema,
  ListTripsQuerySchema,
  UpdateTripSchema
} from "./trips.validation";
import { type TripListResponse, type TripResponse } from "./models";

@ApiTags("trips")
@Controller("trips")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  /**
   * Create a trip
   *  POST /trips
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @ZodBody(CreateTripSchema) body: CreateTripDto
  ): Promise<TripResponse> {
    return this.tripsService.create(userId, body);
  }

  /**
   * List trips of the authenticated user
   *  GET /trips?page=1&limit=20
   */
  @Get()
  async findAll(
    @CurrentUser("sub") userId: string,
    @ZodQuery(ListTripsQuerySchema) query: ListTripsQuery
  ): Promise<TripListResponse> {
    return this.tripsService.findAll(userId, query);
  }

  /**
   * Get trip detail
   *  GET /trips/:id
   */
  @Get(":id")
  async findOne(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) tripId: string
  ): Promise<TripResponse> {
    return this.tripsService.findOne(userId, tripId);
  }

  /**
   * Update trip
   *  PATCH /trips/:id
   */
  @Patch(":id")
  async update(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) tripId: string,
    @ZodBody(UpdateTripSchema) body: UpdateTripDto
  ): Promise<TripResponse> {
    return this.tripsService.update(userId, tripId, body);
  }

  /**
   * Delete trip
   *  DELETE /trips/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) tripId: string
  ): Promise<null> {
    await this.tripsService.remove(userId, tripId);
    return null;
  }

  /**
   * Copy a trip (any member) into a new trip owned by the current user
   *  POST /trips/:id/duplicate
   */
  @Post(":id/duplicate")
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @CurrentUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) tripId: string,
    @ZodBody(DuplicateTripSchema) body: DuplicateTripDto
  ): Promise<TripResponse> {
    return this.tripsService.duplicate(userId, tripId, body);
  }
}
