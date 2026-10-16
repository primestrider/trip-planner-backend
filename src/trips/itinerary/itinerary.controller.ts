import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ItineraryService } from "./itinerary.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import {
  type CreateItineraryItemDto,
  type UpdateItineraryItemDto,
  CreateItineraryItemSchema,
  UpdateItineraryItemSchema
} from "./itinerary.validation";
import {
  type ItineraryDayResponse,
  type ItineraryItemResponse,
  type ItineraryResponse
} from "./models";

@Controller("trips/:tripId/itinerary")
@UseGuards(AccessTokenGuard)
export class ItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  /**
   * Get full itinerary grouped per day
   *  GET /trips/:tripId/itinerary
   */
  @Get()
  async getItinerary(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<ItineraryResponse> {
    return this.itineraryService.getItinerary(userId, tripId);
  }

  /**
   * Get itinerary of a single day
   *  GET /trips/:tripId/itinerary/days/:dayNumber
   */
  @Get("days/:dayNumber")
  async getDay(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("dayNumber", ParseIntPipe) dayNumber: number
  ): Promise<ItineraryDayResponse> {
    return this.itineraryService.getDay(userId, tripId, dayNumber);
  }

  /**
   * Add an item to a day
   *  POST /trips/:tripId/itinerary
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createItem(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body(ValidationPipe(CreateItineraryItemSchema))
    body: CreateItineraryItemDto
  ): Promise<ItineraryItemResponse> {
    return this.itineraryService.createItem(userId, tripId, body);
  }

  /**
   * Update an item (or move it to another day)
   *  PATCH /trips/:tripId/itinerary/:itemId
   */
  @Patch(":itemId")
  async updateItem(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body(ValidationPipe(UpdateItineraryItemSchema))
    body: UpdateItineraryItemDto
  ): Promise<ItineraryItemResponse> {
    return this.itineraryService.updateItem(userId, tripId, itemId, body);
  }

  /**
   * Delete an item
   *  DELETE /trips/:tripId/itinerary/:itemId
   */
  @Delete(":itemId")
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string
  ): Promise<null> {
    await this.itineraryService.deleteItem(userId, tripId, itemId);
    return null;
  }
}
