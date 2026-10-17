import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

export const TRIP_ACTIVITY_EVENT = "trip.activity";

/**
 * Things that happen on a trip and appear in its activity feed
 */
export type TripActivityAction =
  | "trip.updated"
  | "member.added"
  | "member.joined_via_invite"
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "ownership.transferred"
  | "itinerary.item_added"
  | "itinerary.item_deleted"
  | "accommodation.added"
  | "transport.added"
  | "expense.added"
  | "expense.deleted"
  | "checklist.item_checked"
  | "checklist.item_unchecked";

export type TripActivityEvent = {
  tripId: string;
  // user who did it; null for system actions
  actorUserId: string | null;
  action: TripActivityAction;
  // small, display-oriented details (titles, amounts, roles)
  data?: Record<string, string | number | boolean | null | string[]>;
};

/**
 * Publishes trip activity events.
 *
 * Services only announce what happened; recording it in the feed is the
 * listener's job, so features stay unaware of how activity is stored.
 */
@Injectable()
export class ActivityPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publish(event: TripActivityEvent): void {
    this.eventEmitter.emit(TRIP_ACTIVITY_EVENT, event);
  }
}
