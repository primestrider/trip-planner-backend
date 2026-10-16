import { TransportType } from "@prisma/client";
import { LocationResponse } from "../../location";
import { AccommodationEvent } from "../../itinerary/models";

export type ShareLinkResponse = {
  enabled: boolean;
  // secret part of the public link, e.g. https://<app>/shared/<token>
  token: string | null;
};

/**
 * Read-only view of a trip for anyone with the share link.
 * Booking codes, notes, budget, expenses, members and checklist
 * are left out.
 */
export type PublicTripResponse = {
  trip: {
    title: string;
    destination: string;
    description: string | null;
    coverImageUrl: string | null;
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  days: {
    dayNumber: number;
    date: string;
    items: {
      title: string;
      description: string | null;
      location: LocationResponse | null;
      startTime: string | null;
      endTime: string | null;
    }[];
    accommodations: {
      event: AccommodationEvent;
      name: string;
      location: LocationResponse | null;
      checkInDate: string;
      checkOutDate: string;
    }[];
    transports: {
      type: TransportType;
      carrier: string | null;
      number: string | null;
      origin: LocationResponse | null;
      destination: LocationResponse | null;
      departureAt: string;
      arrivalAt: string | null;
    }[];
  }[];
};
