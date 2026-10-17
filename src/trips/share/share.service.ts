import { randomBytes } from "crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { TripsRepository } from "../trips.repository";
import { ItineraryService } from "../itinerary/itinerary.service";
import { PublicTripResponse, ShareLinkResponse } from "./models";
import { EnableShareDto } from "./share.validation";
import { toDateString } from "src/utils/date";

// 24 random bytes encoded as base64url
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/**
 * ShareService manages the public read-only link of a trip.
 *
 * The token is stored as-is so the owner can copy the link again:
 * it only grants reading data that is already in the database,
 * unlike invite tokens which grant membership and are hashed.
 */
@Injectable()
export class ShareService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly tripsRepository: TripsRepository,
    private readonly itineraryService: ItineraryService,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  /**
   * Current share link of a trip. Owner only.
   */
  async getLink(userId: string, tripId: string): Promise<ShareLinkResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");
    return { enabled: trip.shareToken !== null, token: trip.shareToken };
  }

  /**
   * Turn on the share link, keeping the existing one unless
   * `regenerate` is set. Owner only.
   */
  async enable(
    userId: string,
    tripId: string,
    payload: EnableShareDto
  ): Promise<ShareLinkResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");

    if (trip.shareToken && !payload.regenerate) {
      return { enabled: true, token: trip.shareToken };
    }

    const token = randomBytes(24).toString("base64url");
    await this.tripsRepository.update(trip.id, { shareToken: token });

    this.logger.info("Trip share link enabled", {
      userId,
      tripId,
      regenerated: Boolean(trip.shareToken)
    });

    return { enabled: true, token };
  }

  /**
   * Turn off the share link so it stops working. Owner only.
   */
  async disable(userId: string, tripId: string): Promise<ShareLinkResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "OWNER");

    if (trip.shareToken) {
      await this.tripsRepository.update(trip.id, { shareToken: null });
      this.logger.info("Trip share link disabled", { userId, tripId });
    }

    return { enabled: false, token: null };
  }

  /**
   * Public, read-only view of a shared trip.
   *
   * @throws NotFoundException if the link is unknown or sharing is off
   */
  async getPublicTrip(token: string): Promise<PublicTripResponse> {
    const trip = TOKEN_PATTERN.test(token)
      ? await this.tripsRepository.findByShareToken(token)
      : null;

    if (!trip) {
      throw new NotFoundException("Shared trip not found");
    }

    const itinerary = await this.itineraryService.buildItinerary(trip);

    return {
      trip: {
        title: trip.title,
        destination: trip.destination,
        description: trip.description,
        coverImageUrl: trip.coverImageUrl,
        startDate: toDateString(trip.startDate),
        endDate: toDateString(trip.endDate),
        totalDays: itinerary.totalDays
      },
      days: itinerary.days.map((day) => ({
        dayNumber: day.dayNumber,
        date: day.date,
        items: day.items.map((item) => ({
          title: item.title,
          description: item.description,
          location: item.location,
          startTime: item.startTime,
          endTime: item.endTime
        })),
        accommodations: day.accommodations.map(({ event, accommodation }) => ({
          event,
          name: accommodation.name,
          location: accommodation.location,
          checkInDate: accommodation.checkInDate,
          checkOutDate: accommodation.checkOutDate
        })),
        transports: day.transports.map((transport) => ({
          type: transport.type,
          carrier: transport.carrier,
          number: transport.number,
          origin: transport.origin,
          destination: transport.destination,
          departureAt: transport.departureAt,
          arrivalAt: transport.arrivalAt
        }))
      }))
    };
  }
}
