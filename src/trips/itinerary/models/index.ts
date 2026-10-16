import { LocationResponse } from "../../location";
import { AccommodationResponse } from "../../accommodations/models";
import { TransportResponse } from "../../transports/models";

export type ItineraryItemResponse = {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  location: LocationResponse | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * One day of the trip. `date` is YYYY-MM-DD,
 * derived from trip startDate + (dayNumber - 1).
 */
export type ItineraryDayResponse = {
  dayNumber: number;
  date: string;
  items: ItineraryItemResponse[];
  // where travelers stay on this date
  accommodations: {
    event: AccommodationEvent;
    accommodation: AccommodationResponse;
  }[];
  // transports departing or arriving on this date (local time)
  transports: TransportResponse[];
};

export type AccommodationEvent = "CHECK_OUT" | "STAY" | "CHECK_IN";

export type ItineraryResponse = {
  tripId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  days: ItineraryDayResponse[];
};
