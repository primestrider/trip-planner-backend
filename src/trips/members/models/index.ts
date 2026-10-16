import { TripRole } from "../../trip-access.service";

export type TripMemberResponse = {
  userId: string;
  username: string;
  name: string | null;
  avatar: { id: number; url: string } | null;
  role: TripRole;
  // when the user joined the trip; `null` for the owner
  joinedAt: Date | null;
};
