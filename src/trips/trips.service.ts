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
  DuplicateTripDto,
  ListTripsQuery,
  UpdateTripDto
} from "./trips.validation";
import { ItineraryRepository } from "./itinerary/itinerary.repository";
import { ChecklistRepository } from "./checklist/checklist.repository";
import {
  addDays,
  countDaysInclusive,
  toDate,
  toDateString
} from "src/utils/date";
import { toAmount } from "./money";
import { ActivityPublisher } from "./activity/activity.events";

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
    private readonly checklistRepository: ChecklistRepository,
    private readonly activity: ActivityPublisher,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(trip: Trip, role: TripRole): TripResponse {
    return {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      currency: trip.currency,
      budgetAmount: toAmount(trip.budgetAmount),
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
      coverImageUrl: payload.coverImageUrl ?? null,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      ...(payload.currency !== undefined && { currency: payload.currency }),
      budgetAmount: payload.budgetAmount ?? null
    });

    this.logger.info("Trip created", { userId, tripId: trip.id });

    return this.toResponse(trip, "OWNER");
  }

  async findAll(
    userId: string,
    query: ListTripsQuery
  ): Promise<TripListResponse> {
    const { page, limit, q, status, role, order } = query;
    const today = toDate(query.today ?? toDateString(new Date()));

    const { items, total } = await this.tripsRepository.findManyForUser(
      userId,
      { q, status, role, order, today },
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
      ...(payload.coverImageUrl !== undefined && {
        coverImageUrl: payload.coverImageUrl
      }),
      ...(payload.startDate !== undefined && {
        startDate: toDate(payload.startDate)
      }),
      ...(payload.endDate !== undefined && {
        endDate: toDate(payload.endDate)
      }),
      ...(payload.currency !== undefined && { currency: payload.currency }),
      ...(payload.budgetAmount !== undefined && {
        budgetAmount: payload.budgetAmount
      })
    });

    this.logger.info("Trip updated", { userId, tripId });

    this.activity.publish({
      tripId: trip.id,
      actorUserId: userId,
      action: "trip.updated",
      data: { fields: Object.keys(payload) }
    });

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

  /**
   * Copy a trip the user can see into a new trip owned by the user.
   *
   * Copies trip details, budget, itinerary and checklist (unchecked,
   * unassigned). Bookings (accommodations, transports), expenses,
   * members and invites belong to the original trip and are not copied.
   */
  async duplicate(
    userId: string,
    tripId: string,
    payload: DuplicateTripDto
  ): Promise<TripResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);

    const [items, checklist] = await Promise.all([
      this.itineraryRepository.findManyByTrip(trip.id),
      this.checklistRepository.findManyByTrip(trip.id)
    ]);

    const startDate = payload.startDate
      ? toDate(payload.startDate)
      : trip.startDate;
    const totalDays = countDaysInclusive(trip.startDate, trip.endDate);

    const copy = await this.tripsRepository.createWithContent({
      userId,
      title: payload.title ?? `${trip.title} (copy)`.slice(0, 150),
      destination: trip.destination,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate,
      endDate: addDays(startDate, totalDays - 1),
      currency: trip.currency,
      budgetAmount: trip.budgetAmount,
      itineraryItems: items.map((item) => ({
        dayNumber: item.dayNumber,
        position: item.position,
        title: item.title,
        description: item.description,
        locationName: item.locationName,
        locationAddress: item.locationAddress,
        locationLatitude: item.locationLatitude,
        locationLongitude: item.locationLongitude,
        locationPlaceId: item.locationPlaceId,
        locationUrl: item.locationUrl,
        startTime: item.startTime,
        endTime: item.endTime
      })),
      checklistItems: checklist.map((entry) => ({
        title: entry.title,
        category: entry.category
      }))
    });

    this.logger.info("Trip duplicated", {
      userId,
      sourceTripId: trip.id,
      tripId: copy.id
    });

    return this.toResponse(copy, "OWNER");
  }
}
