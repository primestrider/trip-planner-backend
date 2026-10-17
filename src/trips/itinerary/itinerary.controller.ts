import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { parseIfMatch } from "src/common/http/if-match";

const IF_MATCH_HEADER = {
  name: "If-Match",
  required: false,
  description:
    'Item version you edited, e.g. "3". Returns 412 if someone changed the item since.'
};
import { ZodBody } from "src/common/validation/zod.decorators";
import { ItineraryService } from "./itinerary.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type CreateItineraryItemDto,
  type UpdateItineraryItemDto,
  CreateItineraryItemSchema,
  ReorderItineraryDaySchema,
  type ReorderItineraryDayDto,
  UpdateItineraryItemSchema
} from "./itinerary.validation";
import {
  type ItineraryDayResponse,
  type ItineraryItemResponse,
  type ItineraryResponse
} from "./models";

@ApiTags("itinerary")
@Controller("trips/:tripId/itinerary")
@ApiBearerAuth()
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
   * Set the manual order of a day's items (drag & drop)
   *  PUT /trips/:tripId/itinerary/days/:dayNumber/order
   */
  @Put("days/:dayNumber/order")
  async reorderDay(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("dayNumber", ParseIntPipe) dayNumber: number,
    @ZodBody(ReorderItineraryDaySchema)
    body: ReorderItineraryDayDto
  ): Promise<ItineraryDayResponse> {
    return this.itineraryService.reorderDay(userId, tripId, dayNumber, body);
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
    @ZodBody(CreateItineraryItemSchema)
    body: CreateItineraryItemDto
  ): Promise<ItineraryItemResponse> {
    return this.itineraryService.createItem(userId, tripId, body);
  }

  /**
   * Update an item (or move it to another day)
   *  PATCH /trips/:tripId/itinerary/:itemId
   */
  @Patch(":itemId")
  @ApiHeader(IF_MATCH_HEADER)
  async updateItem(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @ZodBody(UpdateItineraryItemSchema)
    body: UpdateItineraryItemDto,
    @Headers("if-match") ifMatch?: string
  ): Promise<ItineraryItemResponse> {
    return this.itineraryService.updateItem(
      userId,
      tripId,
      itemId,
      body,
      parseIfMatch(ifMatch)
    );
  }

  /**
   * Delete an item
   *  DELETE /trips/:tripId/itinerary/:itemId
   */
  @Delete(":itemId")
  @HttpCode(HttpStatus.OK)
  @ApiHeader(IF_MATCH_HEADER)
  async deleteItem(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Headers("if-match") ifMatch?: string
  ): Promise<null> {
    await this.itineraryService.deleteItem(
      userId,
      tripId,
      itemId,
      parseIfMatch(ifMatch)
    );
    return null;
  }
}
