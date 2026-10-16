import { Injectable } from "@nestjs/common";
import { Prisma, TripTransport } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

/**
 * TransportsRepository
 *
 * Repository responsible for interacting with the `trip_transports` table.
 * Queries are scoped by `tripId`; access is checked by the caller.
 */
@Injectable()
export class TransportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.TripTransportUncheckedCreateInput
  ): Promise<TripTransport> {
    return this.prisma.tripTransport.create({ data });
  }

  async findByIdAndTrip(
    transportId: string,
    tripId: string
  ): Promise<TripTransport | null> {
    return this.prisma.tripTransport.findFirst({
      where: { id: transportId, tripId }
    });
  }

  /**
   * List transports of a trip by departure time.
   */
  async findManyByTrip(tripId: string): Promise<TripTransport[]> {
    return this.prisma.tripTransport.findMany({
      where: { tripId },
      orderBy: [{ departureAt: "asc" }, { createdAt: "asc" }]
    });
  }

  async update(
    transportId: string,
    data: Prisma.TripTransportUpdateInput
  ): Promise<TripTransport> {
    return this.prisma.tripTransport.update({
      where: { id: transportId },
      data
    });
  }

  async delete(transportId: string): Promise<void> {
    await this.prisma.tripTransport.delete({
      where: { id: transportId }
    });
  }
}
