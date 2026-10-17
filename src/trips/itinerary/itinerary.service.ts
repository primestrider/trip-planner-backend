import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ItineraryItem,
  Trip,
  TripAccommodation,
  TripTransport
} from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { ItineraryRepository } from "./itinerary.repository";
import {
  AccommodationEvent,
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse
} from "./models";
import {
  CreateItineraryItemDto,
  ReorderItineraryDayDto,
  UpdateItineraryItemDto
} from "./itinerary.validation";
import { addDays, countDaysInclusive, toDateString } from "src/utils/date";
import { toLocationColumns, toLocationResponse } from "../location";
import { AccommodationsRepository } from "../accommodations/accommodations.repository";
import { toAccommodationResponse } from "../accommodations/accommodations.service";
import { TransportsRepository } from "../transports/transports.repository";
import { toTransportResponse } from "../transports/transports.service";
import { ActivityPublisher } from "../activity/activity.events";

const EVENT_ORDER: Record<AccommodationEvent, number> = {
  CHECK_OUT: 0,
  STAY: 1,
  CHECK_IN: 2
};

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
    private readonly accommodationsRepository: AccommodationsRepository,
    private readonly transportsRepository: TransportsRepository,
    private readonly activity: ActivityPublisher,
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
   * Build one day: its itinerary items plus the accommodations and
   * transports that fall on its date.
   *
   * @param items items of this day, already ordered
   */
  private buildDay(
    trip: Trip,
    dayNumber: number,
    items: ItineraryItem[],
    accommodations: TripAccommodation[],
    transports: TripTransport[]
  ): ItineraryDayResponse {
    const date = this.dayDate(trip, dayNumber);

    const stays = accommodations
      .flatMap((accommodation) => {
        const checkIn = toDateString(accommodation.checkInDate);
        const checkOut = toDateString(accommodation.checkOutDate);

        if (date < checkIn || date > checkOut) {
          return [];
        }

        const event: AccommodationEvent =
          date === checkIn
            ? "CHECK_IN"
            : date === checkOut
              ? "CHECK_OUT"
              : "STAY";

        return [
          { event, accommodation: toAccommodationResponse(accommodation) }
        ];
      })
      .sort((a, b) => EVENT_ORDER[a.event] - EVENT_ORDER[b.event]);

    const moves = transports.filter(
      (transport) =>
        toDateString(transport.departureAt) === date ||
        (transport.arrivalAt !== null &&
          toDateString(transport.arrivalAt) === date)
    );

    return {
      dayNumber,
      date,
      items: items.map((item) => this.toItemResponse(item)),
      accommodations: stays,
      transports: moves.map((transport) => toTransportResponse(transport))
    };
  }

  /**
   * Full itinerary grouped per day, including days without items.
   */
  async getItinerary(
    userId: string,
    tripId: string
  ): Promise<ItineraryResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    return this.buildItinerary(trip);
  }

  /**
   * Itinerary of a trip grouped per day. Does not check access;
   * callers must have authorized reading the trip.
   */
  async buildItinerary(trip: Trip): Promise<ItineraryResponse> {
    const [items, accommodations, transports] = await Promise.all([
      this.itineraryRepository.findManyByTrip(trip.id),
      this.accommodationsRepository.findManyByTrip(trip.id),
      this.transportsRepository.findManyByTrip(trip.id)
    ]);
    const totalDays = this.totalDays(trip);

    const days = Array.from({ length: totalDays }, (_, index) =>
      this.buildDay(
        trip,
        index + 1,
        items.filter((item) => item.dayNumber === index + 1),
        accommodations,
        transports
      )
    );

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

    const [items, accommodations, transports] = await Promise.all([
      this.itineraryRepository.findManyByTripAndDay(trip.id, dayNumber),
      this.accommodationsRepository.findManyByTrip(trip.id),
      this.transportsRepository.findManyByTrip(trip.id)
    ]);

    return this.buildDay(trip, dayNumber, items, accommodations, transports);
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
      // new items go to the end of the day
      position: await this.itineraryRepository.nextPosition(
        trip.id,
        payload.dayNumber
      ),
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

    this.activity.publish({
      tripId: trip.id,
      actorUserId: userId,
      action: "itinerary.item_added",
      data: { itemId: item.id, dayNumber: item.dayNumber, title: item.title }
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

    const movesDay =
      payload.dayNumber !== undefined && payload.dayNumber !== item.dayNumber;

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
      // an item moved to another day goes to the end of that day
      ...(movesDay && {
        dayNumber: payload.dayNumber,
        position: await this.itineraryRepository.nextPosition(
          trip.id,
          payload.dayNumber!
        )
      }),
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

    this.activity.publish({
      tripId: trip.id,
      actorUserId: userId,
      action: "itinerary.item_deleted",
      data: { dayNumber: item.dayNumber, title: item.title }
    });
  }

  /**
   * Set the manual order of a day (drag & drop).
   * Timed items still follow their start time; the manual order applies
   * to untimed items and items with the same start time.
   *
   * @throws BadRequestException unless `itemIds` is exactly the day's items
   */
  async reorderDay(
    userId: string,
    tripId: string,
    dayNumber: number,
    payload: ReorderItineraryDayDto
  ): Promise<ItineraryDayResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    this.ensureDayInTrip(trip, dayNumber);

    const items = await this.itineraryRepository.findManyByTripAndDay(
      trip.id,
      dayNumber
    );
    const dayIds = new Set(items.map((item) => item.id));

    if (
      payload.itemIds.length !== dayIds.size ||
      payload.itemIds.some((id) => !dayIds.has(id))
    ) {
      throw new BadRequestException(
        "itemIds must list every item of the day exactly once"
      );
    }

    await this.itineraryRepository.reorder(trip.id, payload.itemIds);

    this.logger.info("Itinerary day reordered", { userId, tripId, dayNumber });

    return this.getDay(userId, tripId, dayNumber);
  }
}
