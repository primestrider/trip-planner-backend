import { Injectable } from "@nestjs/common";
import { Prisma, Trip } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";

/**
 * Trip with the membership of one user (empty when the user is the owner
 * or not a member), used to resolve that user's role on the trip.
 */
export type TripWithMembership = Prisma.TripGetPayload<{
  include: { members: { select: { role: true } } };
}>;

/**
 * Trips the user owns or is a member of
 */
function accessibleBy(userId: string): Prisma.TripWhereInput {
  return {
    OR: [{ userId }, { members: { some: { userId } } }]
  };
}

function membershipOf(userId: string) {
  return {
    members: { where: { userId }, select: { role: true } }
  } satisfies Prisma.TripInclude;
}

/**
 * TripsRepository
 *
 * Repository responsible for interacting with the `trips` table.
 * Read queries are scoped to trips the user owns or is a member of.
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
   * Find a trip the user can access, with the user's membership.
   *
   * @returns Trip record if found, otherwise `null`
   */
  async findByIdForUser(
    tripId: string,
    userId: string
  ): Promise<TripWithMembership | null> {
    return this.prisma.trip.findFirst({
      where: { id: tripId, ...accessibleBy(userId) },
      include: membershipOf(userId)
    });
  }

  /**
   * List trips the user owns or is a member of,
   * ordered by start date (newest first).
   *
   * @returns Page of trips and total count
   */
  async findManyForUser(
    userId: string,
    skip: number,
    take: number
  ): Promise<{ items: TripWithMembership[]; total: number }> {
    const where = accessibleBy(userId);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        include: membershipOf(userId),
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

  /**
   * Create a trip together with its itinerary and checklist in one statement.
   */
  async createWithContent(
    data: Omit<
      Prisma.TripUncheckedCreateInput,
      "itineraryItems" | "checklistItems"
    > & {
      itineraryItems: Prisma.ItineraryItemCreateManyTripInput[];
      checklistItems: Prisma.TripChecklistItemCreateManyTripInput[];
    }
  ): Promise<Trip> {
    const { itineraryItems, checklistItems, ...trip } = data;

    return this.prisma.trip.create({
      data: {
        ...trip,
        itineraryItems: { createMany: { data: itineraryItems } },
        checklistItems: { createMany: { data: checklistItems } }
      }
    });
  }
}
