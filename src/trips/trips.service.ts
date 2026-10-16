import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable
} from "@nestjs/common";
import { Trip } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripsRepository } from "./trips.repository";
import { roleOf, TripAccessService, TripRole } from "./trip-access.service";
import { TripListResponse, TripResponse } from "./models";
import {
  CreateTripDto,
  ListTripsQuery,
  UpdateTripDto
} from "./trips.validation";
import { ItineraryRepository } from "./itinerary/itinerary.repository";
import { countDaysInclusive, toDate, toDateString } from "src/utils/date";

/**
 * TripsService contains business logic for managing trips
 * the authenticated user owns or collaborates on.
 */
@Injectable()
export class TripsService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly tripAccess: TripAccessService,
    private readonly itineraryRepository: ItineraryRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(trip: Trip, role: TripRole): TripResponse {
    return {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      role,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt
    };
  }

  async create(userId: string, payload: CreateTripDto): Promise<TripResponse> {
    const trip = await this.tripsRepository.create({
      userId,
      title: payload.title,
      destination: payload.destination,
      description: payload.description ?? null,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate)
    });

    this.logger.info("Trip created", { userId, tripId: trip.id });

    return this.toResponse(trip, "OWNER");
  }

  async findAll(
    userId: string,
    query: ListTripsQuery
  ): Promise<TripListResponse> {
    const { page, limit } = query;

    const { items, total } = await this.tripsRepository.findManyForUser(
      userId,
      (page - 1) * limit,
      limit
    );

    return {
      items: items.map((trip) => this.toResponse(trip, roleOf(trip, userId))),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(userId: string, tripId: string): Promise<TripResponse> {
    const { trip, role } = await this.tripAccess.getTrip(userId, tripId);
    return this.toResponse(trip, role);
  }

  /**
   * Partially update a trip. Requires EDITOR access.
   *
   * @throws NotFoundException if user has no access to the trip
   * @throws ForbiddenException if user is only a viewer
   * @throws BadRequestException if resulting date range is invalid
   */
  async update(
    userId: string,
    tripId: string,
    payload: UpdateTripDto
  ): Promise<TripResponse> {
    const { trip, role } = await this.tripAccess.getTrip(
      userId,
      tripId,
      "EDITOR"
    );

    // validate against stored dates when only one side is changed
    const startDate = payload.startDate ?? toDateString(trip.startDate);
    const endDate = payload.endDate ?? toDateString(trip.endDate);

    if (endDate < startDate) {
      throw new BadRequestException("End date must be on or after start date");
    }

    // itinerary is stored per day number, so the trip cannot get
    // shorter than its last planned day
    const totalDays = countDaysInclusive(toDate(startDate), toDate(endDate));
    const lastPlannedDay = await this.itineraryRepository.findMaxDayNumber(
      trip.id
    );

    if (lastPlannedDay !== null && totalDays < lastPlannedDay) {
      throw new ConflictException(
        `Trip has itinerary on day ${lastPlannedDay}; move or delete it before shortening the trip`
      );
    }

    const updated = await this.tripsRepository.update(trip.id, {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.destination !== undefined && {
        destination: payload.destination
      }),
      ...(payload.description !== undefined && {
        description: payload.description
      }),
      ...(payload.startDate !== undefined && {
        startDate: toDate(payload.startDate)
      }),
      ...(payload.endDate !== undefined && {
        endDate: toDate(payload.endDate)
      })
    });

    this.logger.info("Trip updated", { userId, tripId });

    return this.toResponse(updated, role);
  }

  /**
   * Delete a trip. Only the owner can delete it.
   */
  async remove(userId: string, tripId: string): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");

    await this.tripsRepository.delete(trip.id);

    this.logger.info("Trip deleted", { userId, tripId });
  }
}
