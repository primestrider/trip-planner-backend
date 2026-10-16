import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { TripAccommodation } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { toLocationColumns, toLocationResponse } from "../location";
import { AccommodationsRepository } from "./accommodations.repository";
import { AccommodationResponse } from "./models";
import {
  CreateAccommodationDto,
  UpdateAccommodationDto
} from "./accommodations.validation";
import { countDaysInclusive, toDate, toDateString } from "src/utils/date";

/**
 * Map a stored accommodation to its API response
 */
export function toAccommodationResponse(
  accommodation: TripAccommodation
): AccommodationResponse {
  return {
    id: accommodation.id,
    name: accommodation.name,
    location: toLocationResponse(accommodation),
    checkInDate: toDateString(accommodation.checkInDate),
    checkOutDate: toDateString(accommodation.checkOutDate),
    nights:
      countDaysInclusive(
        accommodation.checkInDate,
        accommodation.checkOutDate
      ) - 1,
    bookingCode: accommodation.bookingCode,
    notes: accommodation.notes,
    createdAt: accommodation.createdAt,
    updatedAt: accommodation.updatedAt
  };
}

/**
 * AccommodationsService manages where travelers stay during a trip.
 * Any member can read; EDITOR or OWNER can change.
 */
@Injectable()
export class AccommodationsService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly accommodationsRepository: AccommodationsRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  /**
   * @throws NotFoundException if accommodation does not belong to the trip
   */
  private async findAccommodation(
    tripId: string,
    accommodationId: string
  ): Promise<TripAccommodation> {
    const accommodation = await this.accommodationsRepository.findByIdAndTrip(
      accommodationId,
      tripId
    );

    if (!accommodation) {
      throw new NotFoundException("Accommodation not found");
    }

    return accommodation;
  }

  async list(userId: string, tripId: string): Promise<AccommodationResponse[]> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const accommodations = await this.accommodationsRepository.findManyByTrip(
      trip.id
    );

    return accommodations.map((accommodation) =>
      toAccommodationResponse(accommodation)
    );
  }

  async findOne(
    userId: string,
    tripId: string,
    accommodationId: string
  ): Promise<AccommodationResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    return toAccommodationResponse(
      await this.findAccommodation(trip.id, accommodationId)
    );
  }

  async create(
    userId: string,
    tripId: string,
    payload: CreateAccommodationDto
  ): Promise<AccommodationResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");

    const accommodation = await this.accommodationsRepository.create({
      tripId: trip.id,
      name: payload.name,
      ...toLocationColumns(payload.location ?? null),
      checkInDate: toDate(payload.checkInDate),
      checkOutDate: toDate(payload.checkOutDate),
      bookingCode: payload.bookingCode ?? null,
      notes: payload.notes ?? null
    });

    this.logger.info("Accommodation created", {
      userId,
      tripId,
      accommodationId: accommodation.id
    });

    return toAccommodationResponse(accommodation);
  }

  /**
   * Partially update an accommodation.
   *
   * @throws BadRequestException if resulting stay has no nights
   */
  async update(
    userId: string,
    tripId: string,
    accommodationId: string,
    payload: UpdateAccommodationDto
  ): Promise<AccommodationResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const accommodation = await this.findAccommodation(
      trip.id,
      accommodationId
    );

    // validate against stored dates when only one side is changed
    const checkInDate =
      payload.checkInDate ?? toDateString(accommodation.checkInDate);
    const checkOutDate =
      payload.checkOutDate ?? toDateString(accommodation.checkOutDate);

    if (checkOutDate <= checkInDate) {
      throw new BadRequestException(
        "Check-out date must be after check-in date"
      );
    }

    const updated = await this.accommodationsRepository.update(
      accommodation.id,
      {
        ...(payload.name !== undefined && { name: payload.name }),
        // location is replaced as a whole; `null` clears it
        ...(payload.location !== undefined &&
          toLocationColumns(payload.location)),
        ...(payload.checkInDate !== undefined && {
          checkInDate: toDate(payload.checkInDate)
        }),
        ...(payload.checkOutDate !== undefined && {
          checkOutDate: toDate(payload.checkOutDate)
        }),
        ...(payload.bookingCode !== undefined && {
          bookingCode: payload.bookingCode
        }),
        ...(payload.notes !== undefined && { notes: payload.notes })
      }
    );

    this.logger.info("Accommodation updated", {
      userId,
      tripId,
      accommodationId
    });

    return toAccommodationResponse(updated);
  }

  async remove(
    userId: string,
    tripId: string,
    accommodationId: string
  ): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const accommodation = await this.findAccommodation(
      trip.id,
      accommodationId
    );

    await this.accommodationsRepository.delete(accommodation.id);

    this.logger.info("Accommodation deleted", {
      userId,
      tripId,
      accommodationId
    });
  }
}
