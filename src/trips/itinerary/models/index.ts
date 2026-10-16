import { LocationResponse } from "../../location";

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
};

export type ItineraryResponse = {
  tripId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  days: ItineraryDayResponse[];
};
