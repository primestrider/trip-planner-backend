import { TripActivityEvent } from "../activity.events";

export type ActivityResponse = {
  id: string;
  // a TripActivityAction; typed as string because older rows may hold
  // actions that were renamed or removed since
  action: string;
  // null when done by the system or the user was deleted
  actor: { userId: string; username: string; name: string | null } | null;
  data: TripActivityEvent["data"] | null;
  createdAt: Date;
};

export type ActivityPageResponse = {
  items: ActivityResponse[];
  // pass as ?cursor= to get the next (older) page; null on the last page
  nextCursor: string | null;
};
