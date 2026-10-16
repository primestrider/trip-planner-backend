import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { TripTransport } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { toLocationColumns, toLocationResponse } from "../location";
import { TransportsRepository } from "./transports.repository";
import { TransportResponse } from "./models";
import {
  CreateTransportDto,
  UpdateTransportDto
} from "./transports.validation";
import { toLocalDateTime, toLocalDateTimeString } from "src/utils/date";

/**
 * Map a stored transport to its API response
 */
export function toTransportResponse(
  transport: TripTransport
): TransportResponse {
  return {
    id: transport.id,
    type: transport.type,
    carrier: transport.carrier,
    number: transport.number,
    origin: toLocationResponse(transport, "origin"),
    destination: toLocationResponse(transport, "destination"),
    departureAt: toLocalDateTimeString(transport.departureAt),
    arrivalAt: transport.arrivalAt
      ? toLocalDateTimeString(transport.arrivalAt)
      : null,
    bookingCode: transport.bookingCode,
    notes: transport.notes,
    createdAt: transport.createdAt,
    updatedAt: transport.updatedAt
  };
}

/**
 * TransportsService manages how travelers move during a trip
 * (flights, trains, rentals, ...).
 * Any member can read; EDITOR or OWNER can change.
 */
@Injectable()
export class TransportsService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly transportsRepository: TransportsRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  /**
   * @throws NotFoundException if transport does not belong to the trip
   */
  private async findTransport(
    tripId: string,
    transportId: string
  ): Promise<TripTransport> {
    const transport = await this.transportsRepository.findByIdAndTrip(
      transportId,
      tripId
    );

    if (!transport) {
      throw new NotFoundException("Transport not found");
    }

    return transport;
  }

  async list(userId: string, tripId: string): Promise<TransportResponse[]> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const transports = await this.transportsRepository.findManyByTrip(trip.id);

    return transports.map((transport) => toTransportResponse(transport));
  }

  async findOne(
    userId: string,
    tripId: string,
    transportId: string
  ): Promise<TransportResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    return toTransportResponse(await this.findTransport(trip.id, transportId));
  }

  async create(
    userId: string,
    tripId: string,
    payload: CreateTransportDto
  ): Promise<TransportResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");

    const transport = await this.transportsRepository.create({
      tripId: trip.id,
      type: payload.type,
      carrier: payload.carrier ?? null,
      number: payload.number ?? null,
      ...toLocationColumns(payload.origin, "origin"),
      ...toLocationColumns(payload.destination, "destination"),
      departureAt: toLocalDateTime(payload.departureAt),
      arrivalAt: payload.arrivalAt ? toLocalDateTime(payload.arrivalAt) : null,
      bookingCode: payload.bookingCode ?? null,
      notes: payload.notes ?? null
    });

    this.logger.info("Transport created", {
      userId,
      tripId,
      transportId: transport.id
    });

    return toTransportResponse(transport);
  }

  async update(
    userId: string,
    tripId: string,
    transportId: string,
    payload: UpdateTransportDto
  ): Promise<TransportResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const transport = await this.findTransport(trip.id, transportId);

    const updated = await this.transportsRepository.update(transport.id, {
      ...(payload.type !== undefined && { type: payload.type }),
      ...(payload.carrier !== undefined && { carrier: payload.carrier }),
      ...(payload.number !== undefined && { number: payload.number }),
      // locations are replaced as a whole
      ...(payload.origin !== undefined &&
        toLocationColumns(payload.origin, "origin")),
      ...(payload.destination !== undefined &&
        toLocationColumns(payload.destination, "destination")),
      ...(payload.departureAt !== undefined && {
        departureAt: toLocalDateTime(payload.departureAt)
      }),
      ...(payload.arrivalAt !== undefined && {
        arrivalAt: payload.arrivalAt ? toLocalDateTime(payload.arrivalAt) : null
      }),
      ...(payload.bookingCode !== undefined && {
        bookingCode: payload.bookingCode
      }),
      ...(payload.notes !== undefined && { notes: payload.notes })
    });

    this.logger.info("Transport updated", { userId, tripId, transportId });

    return toTransportResponse(updated);
  }

  async remove(
    userId: string,
    tripId: string,
    transportId: string
  ): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const transport = await this.findTransport(trip.id, transportId);

    await this.transportsRepository.delete(transport.id);

    this.logger.info("Transport deleted", { userId, tripId, transportId });
  }
}
