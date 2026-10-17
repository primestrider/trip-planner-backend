import { Injectable } from "@nestjs/common";
import { ItineraryItem, Prisma } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

/**
 * Items of a day: timed items by start time, untimed items last.
 * Untimed items and equal start times follow the manual position,
 * then creation order.
 */
const itemOrder: Prisma.ItineraryItemOrderByWithRelationInput[] = [
  { startTime: { sort: "asc", nulls: "last" } },
  { position: "asc" },
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

  /**
   * Update an item and bump its version.
   *
   * With `expectedVersion` the row is only changed if its version still
   * matches (optimistic locking): the check and the write are one
   * UPDATE ... WHERE id = ? AND version = ?, so two editors can never both
   * win with stale data.
   *
   * @returns the updated item, or `null` if the version no longer matches
   */
  async update(
    itemId: string,
    data: Prisma.ItineraryItemUncheckedUpdateManyInput,
    expectedVersion?: number
  ): Promise<ItineraryItem | null> {
    const { count } = await this.prisma.itineraryItem.updateMany({
      where: {
        id: itemId,
        ...(expectedVersion !== undefined && { version: expectedVersion })
      },
      data: { ...data, version: { increment: 1 } }
    });

    if (count === 0) {
      return null;
    }

    return this.prisma.itineraryItem.findUnique({ where: { id: itemId } });
  }

  /**
   * Delete an item; with `expectedVersion` only if it still has that version.
   *
   * @returns `false` if the version no longer matches
   */
  async delete(itemId: string, expectedVersion?: number): Promise<boolean> {
    const { count } = await this.prisma.itineraryItem.deleteMany({
      where: {
        id: itemId,
        ...(expectedVersion !== undefined && { version: expectedVersion })
      }
    });

    return count > 0;
  }

  /**
   * Position right after the last item of a day
   */
  async nextPosition(tripId: string, dayNumber: number): Promise<number> {
    const result = await this.prisma.itineraryItem.aggregate({
      where: { tripId, dayNumber },
      _max: { position: true }
    });

    return (result._max.position ?? -1) + 1;
  }

  /**
   * Set the manual order of a day's items to the order of `itemIds`.
   */
  async reorder(tripId: string, itemIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      itemIds.map((id, position) =>
        this.prisma.itineraryItem.updateMany({
          where: { id, tripId },
          data: { position }
        })
      )
    );
  }
}
