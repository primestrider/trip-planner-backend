import { LocationResponse } from "../../location";

/**
 * Accommodation of a trip. Dates are formatted as YYYY-MM-DD.
 */
export type AccommodationResponse = {
  id: string;
  name: string;
  location: LocationResponse | null;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  bookingCode: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};
