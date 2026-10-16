import { Injectable } from "@nestjs/common";
import { ItineraryItem, Prisma } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

/**
 * Items of a day: timed items by start time, untimed items last,
 * ties by creation order.
 */
const itemOrder: Prisma.ItineraryItemOrderByWithRelationInput[] = [
  { startTime: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" }
];

/**
 * ItineraryRepository
 *
 * Repository responsible for interacting with the `itinerary_items` table.
 * Queries are scoped by `tripId`; trip ownership is checked by the caller.
 */
@Injectable()
export class ItineraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ItineraryItemUncheckedCreateInput
  ): Promise<ItineraryItem> {
    return this.prisma.itineraryItem.create({ data });
  }

  /**
   * Find an item belonging to the trip.
   *
   * @returns Item if found, otherwise `null`
   */
  async findByIdAndTrip(
    itemId: string,
    tripId: string
  ): Promise<ItineraryItem | null> {
    return this.prisma.itineraryItem.findFirst({
      where: { id: itemId, tripId }
    });
  }

  /**
   * List all items of a trip ordered by day.
   */
  async findManyByTrip(tripId: string): Promise<ItineraryItem[]> {
    return this.prisma.itineraryItem.findMany({
      where: { tripId },
      orderBy: [{ dayNumber: "asc" }, ...itemOrder]
    });
  }

  /**
   * List items of a single day of a trip.
   */
  async findManyByTripAndDay(
    tripId: string,
    dayNumber: number
  ): Promise<ItineraryItem[]> {
    return this.prisma.itineraryItem.findMany({
      where: { tripId, dayNumber },
      orderBy: itemOrder
    });
  }

  /**
   * Highest day number that has an item, or `null` if itinerary is empty.
   */
  async findMaxDayNumber(tripId: string): Promise<number | null> {
    const result = await this.prisma.itineraryItem.aggregate({
      where: { tripId },
      _max: { dayNumber: true }
    });

    return result._max.dayNumber;
  }

  async update(
    itemId: string,
    data: Prisma.ItineraryItemUpdateInput
  ): Promise<ItineraryItem> {
    return this.prisma.itineraryItem.update({
      where: { id: itemId },
      data
    });
  }

  async delete(itemId: string): Promise<void> {
    await this.prisma.itineraryItem.delete({
      where: { id: itemId }
    });
  }
}
