import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";
import { TripActivityEvent } from "./activity.events";

const actorInclude = {
  actor: { select: { id: true, username: true, name: true } }
} satisfies Prisma.TripActivityInclude;

export type ActivityWithActor = Prisma.TripActivityGetPayload<{
  include: typeof actorInclude;
}>;

/**
 * Position in the feed: activities are ordered by (createdAt, id) desc
 */
export type ActivityCursor = { createdAt: Date; id: string };

/**
 * ActivityRepository
 *
 * Repository responsible for interacting with the `trip_activities` table.
 */
@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(event: TripActivityEvent): Promise<void> {
    await this.prisma.tripActivity.create({
      data: {
        tripId: event.tripId,
        actorUserId: event.actorUserId,
        action: event.action,
        data: event.data ?? Prisma.JsonNull
      }
    });
  }

  /**
   * One page of a trip's activity, newest first, starting after `cursor`.
   *
   * Keyset pagination: instead of skipping N rows (OFFSET), continue from
   * the last row seen. Pages stay correct while new activity is added and
   * stay fast however deep the user scrolls (uses the index on
   * tripId, createdAt, id).
   */
  async findPage(
    tripId: string,
    cursor: ActivityCursor | null,
    take: number
  ): Promise<ActivityWithActor[]> {
    return this.prisma.tripActivity.findMany({
      where: {
        tripId,
        ...(cursor && {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
          ]
        })
      },
      include: actorInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take
    });
  }
}
