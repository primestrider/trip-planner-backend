import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ItineraryItem, Trip } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { ItineraryRepository } from "./itinerary.repository";
import {
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse
} from "./models";
import {
  CreateItineraryItemDto,
  UpdateItineraryItemDto
} from "./itinerary.validation";
import { addDays, countDaysInclusive, toDateString } from "src/utils/date";
import { toLocationColumns, toLocationResponse } from "../location";

/**
 * ItineraryService manages the day-by-day plan of a trip.
 *
 * Every operation first checks access through TripAccessService:
 * any member can read the itinerary, EDITOR or OWNER can change it.
 */
@Injectable()
export class ItineraryService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly itineraryRepository: ItineraryRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toItemResponse(item: ItineraryItem): ItineraryItemResponse {
    return {
      id: item.id,
      dayNumber: item.dayNumber,
      title: item.title,
      description: item.description,
      location: toLocationResponse(item),
      startTime: item.startTime,
      endTime: item.endTime,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private totalDays(trip: Trip): number {
    return countDaysInclusive(trip.startDate, trip.endDate);
  }

  private dayDate(trip: Trip, dayNumber: number): string {
    return toDateString(addDays(trip.startDate, dayNumber - 1));
  }

  /**
   * @throws BadRequestException if day is outside the trip
   */
  private ensureDayInTrip(trip: Trip, dayNumber: number): void {
    const totalDays = this.totalDays(trip);

    if (dayNumber < 1 || dayNumber > totalDays) {
      throw new BadRequestException(
        `Day must be between 1 and ${totalDays} for this trip`
      );
    }
  }

  /**
   * @throws NotFoundException if item does not belong to the trip
   */
  private async findItem(
    tripId: string,
    itemId: string
  ): Promise<ItineraryItem> {
    const item = await this.itineraryRepository.findByIdAndTrip(itemId, tripId);

    if (!item) {
      throw new NotFoundException("Itinerary item not found");
    }

    return item;
  }

  /**
   * Full itinerary grouped per day, including days without items.
   */
  async getItinerary(
    userId: string,
    tripId: string
  ): Promise<ItineraryResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const items = await this.itineraryRepository.findManyByTrip(trip.id);
    const totalDays = this.totalDays(trip);

    const days: ItineraryDayResponse[] = Array.from(
      { length: totalDays },
      (_, index) => ({
        dayNumber: index + 1,
        date: this.dayDate(trip, index + 1),
        items: []
      })
    );

    for (const item of items) {
      days[item.dayNumber - 1]?.items.push(this.toItemResponse(item));
    }

    return {
      tripId: trip.id,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      totalDays,
      days
    };
  }

  /**
   * Itinerary of a single day.
   */
  async getDay(
    userId: string,
    tripId: string,
    dayNumber: number
  ): Promise<ItineraryDayResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    this.ensureDayInTrip(trip, dayNumber);

    const items = await this.itineraryRepository.findManyByTripAndDay(
      trip.id,
      dayNumber
    );

    return {
      dayNumber,
      date: this.dayDate(trip, dayNumber),
      items: items.map((item) => this.toItemResponse(item))
    };
  }

  async createItem(
    userId: string,
    tripId: string,
    payload: CreateItineraryItemDto
  ): Promise<ItineraryItemResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    this.ensureDayInTrip(trip, payload.dayNumber);

    const item = await this.itineraryRepository.create({
      tripId: trip.id,
      dayNumber: payload.dayNumber,
      title: payload.title,
      description: payload.description ?? null,
      ...toLocationColumns(payload.location ?? null),
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null
    });

    this.logger.info("Itinerary item created", {
      userId,
      tripId,
      itemId: item.id
    });

    return this.toItemResponse(item);
  }

  /**
   * Partially update an item. Changing `dayNumber` moves it to another day.
   *
   * @throws BadRequestException if day is outside the trip or time range is invalid
   */
  async updateItem(
    userId: string,
    tripId: string,
    itemId: string,
    payload: UpdateItineraryItemDto
  ): Promise<ItineraryItemResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const item = await this.findItem(trip.id, itemId);

    if (payload.dayNumber !== undefined) {
      this.ensureDayInTrip(trip, payload.dayNumber);
    }

    // validate against stored times when only one side is changed
    const startTime =
      payload.startTime !== undefined ? payload.startTime : item.startTime;
    const endTime =
      payload.endTime !== undefined ? payload.endTime : item.endTime;

    if (startTime && endTime && endTime < startTime) {
      throw new BadRequestException("End time must be on or after start time");
    }

    const updated = await this.itineraryRepository.update(item.id, {
      ...(payload.dayNumber !== undefined && { dayNumber: payload.dayNumber }),
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && {
        description: payload.description
      }),
      // location is replaced as a whole; `null` clears it
      ...(payload.location !== undefined &&
        toLocationColumns(payload.location)),
      ...(payload.startTime !== undefined && { startTime: payload.startTime }),
      ...(payload.endTime !== undefined && { endTime: payload.endTime })
    });

    this.logger.info("Itinerary item updated", { userId, tripId, itemId });

    return this.toItemResponse(updated);
  }

  async deleteItem(
    userId: string,
    tripId: string,
    itemId: string
  ): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const item = await this.findItem(trip.id, itemId);

    await this.itineraryRepository.delete(item.id);

    this.logger.info("Itinerary item deleted", { userId, tripId, itemId });
  }
}
