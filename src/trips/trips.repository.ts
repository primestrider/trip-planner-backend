import { Injectable } from "@nestjs/common";
import { Prisma, Trip } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";

/**
 * TripsRepository
 *
 * Repository responsible for interacting with the `trips` table.
 * Every query is scoped by `userId` so a user can only reach
 * their own trips.
 */
@Injectable()
export class TripsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new trip.
   */
  async create(data: Prisma.TripUncheckedCreateInput): Promise<Trip> {
    return this.prisma.trip.create({ data });
  }

  /**
   * Find a trip owned by the user.
   *
   * @returns Trip record if found, otherwise `null`
   */
  async findByIdAndUser(tripId: string, userId: string): Promise<Trip | null> {
    return this.prisma.trip.findFirst({
      where: { id: tripId, userId }
    });
  }

  /**
   * List trips owned by the user, ordered by start date (newest first).
   *
   * @returns Page of trips and total count
   */
  async findManyByUser(
    userId: string,
    skip: number,
    take: number
  ): Promise<{ items: Trip[]; total: number }> {
    const where: Prisma.TripWhereInput = { userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        skip,
        take
      }),
      this.prisma.trip.count({ where })
    ]);

    return { items, total };
  }

  /**
   * Update a trip by ID.
   */
  async update(tripId: string, data: Prisma.TripUpdateInput): Promise<Trip> {
    return this.prisma.trip.update({
      where: { id: tripId },
      data
    });
  }

  /**
   * Delete a trip by ID.
   */
  async delete(tripId: string): Promise<void> {
    await this.prisma.trip.delete({
      where: { id: tripId }
    });
  }
}
