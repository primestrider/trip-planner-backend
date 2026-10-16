import { TripMemberRole } from "@prisma/client";
import { TripRole } from "../../trip-access.service";

export type InviteStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "USED_UP";

/**
 * Invite link as seen by the trip owner.
 * The token is only returned once, when the invite is created.
 */
export type InviteResponse = {
  id: string;
  role: TripMemberRole;
  status: InviteStatus;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
  revokedAt: Date | null;
  createdAt: Date;
};

export type CreatedInviteResponse = InviteResponse & {
  // secret part of the link, e.g. https://<app>/invite/<token>
  token: string;
};

/**
 * What a user sees after opening an invite link
 */
export type InvitePreviewResponse = {
  trip: {
    id: string;
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
  };
  invitedBy: { username: string; name: string | null };
  role: TripMemberRole;
  expiresAt: Date;
  // current role of the user on the trip; null if not joined yet
  currentRole: TripRole | null;
};

export type AcceptInviteResponse = {
  tripId: string;
  role: TripRole;
  // true when the user was already on the trip; the invite is not used
  alreadyMember: boolean;
};
