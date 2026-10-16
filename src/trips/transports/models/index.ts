import { TransportType } from "@prisma/client";
import { LocationResponse } from "../../location";

/**
 * Transport of a trip.
 * departureAt / arrivalAt are local times formatted as YYYY-MM-DDTHH:mm.
 */
export type TransportResponse = {
  id: string;
  type: TransportType;
  carrier: string | null;
  number: string | null;
  origin: LocationResponse | null;
  destination: LocationResponse | null;
  departureAt: string;
  arrivalAt: string | null;
  bookingCode: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
