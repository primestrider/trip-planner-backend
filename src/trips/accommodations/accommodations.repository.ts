import { Injectable } from "@nestjs/common";
import { Prisma, TripAccommodation } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

/**
 * AccommodationsRepository
 *
 * Repository responsible for interacting with the `trip_accommodations`
 * table. Queries are scoped by `tripId`; access is checked by the caller.
 */
@Injectable()
export class AccommodationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.TripAccommodationUncheckedCreateInput
  ): Promise<TripAccommodation> {
    return this.prisma.tripAccommodation.create({ data });
  }

  async findByIdAndTrip(
    accommodationId: string,
    tripId: string
  ): Promise<TripAccommodation | null> {
    return this.prisma.tripAccommodation.findFirst({
      where: { id: accommodationId, tripId }
    });
  }

  /**
   * List accommodations of a trip by check-in date.
   */
  async findManyByTrip(tripId: string): Promise<TripAccommodation[]> {
    return this.prisma.tripAccommodation.findMany({
      where: { tripId },
      orderBy: [{ checkInDate: "asc" }, { createdAt: "asc" }]
    });
  }

  async update(
    accommodationId: string,
    data: Prisma.TripAccommodationUpdateInput
  ): Promise<TripAccommodation> {
    return this.prisma.tripAccommodation.update({
      where: { id: accommodationId },
      data
    });
  }

  async delete(accommodationId: string): Promise<void> {
    await this.prisma.tripAccommodation.delete({
      where: { id: accommodationId }
    });
  }
}
