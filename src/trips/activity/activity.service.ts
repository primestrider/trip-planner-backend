import { BadRequestException, Injectable } from "@nestjs/common";
import { TripAccessService } from "../trip-access.service";
import {
  ActivityCursor,
  ActivityRepository,
  ActivityWithActor
} from "./activity.repository";
import { ActivityPageResponse, ActivityResponse } from "./models";
import { ListActivityQuery } from "./activity.validation";

/**
 * Opaque cursor for the client: base64url of the last item's (createdAt, id)
 */
function encodeCursor(activity: ActivityWithActor): string {
  return Buffer.from(
    JSON.stringify([activity.createdAt.toISOString(), activity.id])
  ).toString("base64url");
}

/**
 * @throws BadRequestException if the cursor was not produced by this API
 */
function decodeCursor(cursor: string): ActivityCursor {
  try {
    const [createdAt, id] = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as [string, string];
    const date = new Date(createdAt);

    if (typeof id !== "string" || Number.isNaN(date.getTime())) {
      throw new Error("bad cursor");
    }

    return { createdAt: date, id };
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

/**
 * ActivityService serves the activity feed of a trip to its members.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly activityRepository: ActivityRepository
  ) {}

  private toResponse(activity: ActivityWithActor): ActivityResponse {
    return {
      id: activity.id,
      action: activity.action,
      actor: activity.actor
        ? {
            userId: activity.actor.id,
            username: activity.actor.username,
            name: activity.actor.name
          }
        : null,
      data: activity.data as ActivityResponse["data"],
      createdAt: activity.createdAt
    };
  }

  /**
   * One page of the feed, newest first.
   * Pass `nextCursor` from the previous page to continue.
   */
  async list(
    userId: string,
    tripId: string,
    query: ListActivityQuery
  ): Promise<ActivityPageResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    // fetch one extra row to know whether another page exists
    const rows = await this.activityRepository.findPage(
      trip.id,
      cursor,
      query.limit + 1
    );
    const items = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;

    return {
      items: items.map((activity) => this.toResponse(activity)),
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null
    };
  }
}
