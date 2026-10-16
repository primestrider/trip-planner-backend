import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Trip } from "@prisma/client";
import { TripsRepository, TripWithMembership } from "./trips.repository";

/**
 * Role of the current user on a trip.
 * OWNER is the trip creator; EDITOR and VIEWER are collaborators.
 */
export type TripRole = "OWNER" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<TripRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3
};

/**
 * Resolve the role of a user on a trip loaded with that user's membership
 */
export function roleOf(
  trip: Pick<TripWithMembership, "userId" | "members">,
  userId: string
): TripRole {
  if (trip.userId === userId) {
    return "OWNER";
  }

  // trips are only loaded when the user is owner or member
  return trip.members[0]?.role ?? "VIEWER";
}

/**
 * TripAccessService is the single place that decides
 * whether a user may read or change a trip and everything inside it.
 *
 * - VIEWER: read trip and its content
 * - EDITOR: also change trip details and its content
 * - OWNER : also delete the trip and manage members
 */
@Injectable()
export class TripAccessService {
  constructor(private readonly tripsRepository: TripsRepository) {}

  /**
   * Load a trip the user can access with at least `minRole`.
   *
   * Trips the user cannot see are reported as not found
   * so their existence is not leaked.
   *
   * @throws NotFoundException if user has no access to the trip
   * @throws ForbiddenException if user's role is lower than `minRole`
   */
  async getTrip(
    userId: string,
    tripId: string,
    minRole: TripRole = "VIEWER"
  ): Promise<{ trip: Trip; role: TripRole }> {
    const found = await this.tripsRepository.findByIdForUser(tripId, userId);

    if (!found) {
      throw new NotFoundException("Trip not found");
    }

    const { members, ...trip } = found;
    const role = roleOf({ userId: trip.userId, members }, userId);

    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(
        `This action requires ${minRole} access to the trip`
      );
    }

    return { trip, role };
  }
}
