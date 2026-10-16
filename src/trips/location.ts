import { Prisma } from "@prisma/client";
import { z } from "zod";

/**
 * Location of a place, typically picked from Google Maps.
 *
 * Only `name` is required, so the client can store just a label,
 * a Google Place ID, coordinates, or a pasted Google Maps link.
 */

const GOOGLE_MAPS_HOSTS = [
  /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/, // google.com/maps, google.co.id/maps
  /^maps\.google\.[a-z]{2,3}(\.[a-z]{2})?$/
];

/**
 * Accept only https links that point to Google Maps
 */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();

  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (host.startsWith("maps.")) {
    return GOOGLE_MAPS_HOSTS[1].test(host);
  }

  return GOOGLE_MAPS_HOSTS[0].test(host) && url.pathname.startsWith("/maps");
}

export const LocationSchema = z
  .object({
    name: z.string().trim().min(1).max(255),

    address: z.string().trim().max(500).nullable().optional(),

    latitude: z.number().min(-90).max(90).nullable().optional(),

    longitude: z.number().min(-180).max(180).nullable().optional(),

    // Google Place ID
    placeId: z.string().trim().min(1).max(255).nullable().optional(),

    // Google Maps link pasted by the user
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(isGoogleMapsUrl, "URL must be a Google Maps link")
      .nullable()
      .optional()
  })
  .strict()
  .refine((data) => (data.latitude == null) === (data.longitude == null), {
    path: ["longitude"],
    message: "Latitude and longitude must be provided together"
  });

export type LocationInput = z.infer<typeof LocationSchema>;

export type LocationResponse = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  // link to open the place in Google Maps
  mapsUrl: string;
};

type DecimalLike = Prisma.Decimal | number | null;

/**
 * Columns storing a location. Each column starts with `prefix`
 * so one table can hold several locations
 * (e.g. `locationName`, `originName`, `destinationName`).
 */
export type LocationColumns<P extends string = "location"> = {
  [K in `${P}Name` | `${P}Address` | `${P}PlaceId` | `${P}Url`]: string | null;
} & {
  [K in `${P}Latitude` | `${P}Longitude`]: DecimalLike;
};

/**
 * Map location input to database columns.
 * `null` clears every location column.
 */
export function toLocationColumns<P extends string = "location">(
  location: LocationInput | null,
  prefix: P = "location" as P
): LocationColumns<P> {
  return {
    [`${prefix}Name`]: location?.name ?? null,
    [`${prefix}Address`]: location?.address ?? null,
    [`${prefix}Latitude`]: location?.latitude ?? null,
    [`${prefix}Longitude`]: location?.longitude ?? null,
    [`${prefix}PlaceId`]: location?.placeId ?? null,
    [`${prefix}Url`]: location?.url ?? null
  } as LocationColumns<P>;
}

/**
 * Build a Google Maps link using the Maps URLs format
 * (https://developers.google.com/maps/documentation/urls).
 */
function buildMapsUrl(
  name: string,
  address: string | null,
  latitude: number | null,
  longitude: number | null,
  placeId: string | null
): string {
  const params = new URLSearchParams({ api: "1" });

  if (latitude !== null && longitude !== null) {
    params.set("query", `${latitude},${longitude}`);
  } else {
    params.set("query", address ? `${name}, ${address}` : name);
  }

  if (placeId) {
    params.set("query_place_id", placeId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function toNumber(value: DecimalLike): number | null {
  return value === null ? null : Number(value);
}

/**
 * Map database columns to location response, or `null` if no location is set
 */
export function toLocationResponse<P extends string = "location">(
  record: LocationColumns<P>,
  prefix: P = "location" as P
): LocationResponse | null {
  const columns = record as unknown as Record<string, string | DecimalLike>;
  const name = columns[`${prefix}Name`] as string | null;

  if (!name) {
    return null;
  }

  const address = columns[`${prefix}Address`] as string | null;
  const placeId = columns[`${prefix}PlaceId`] as string | null;
  const url = columns[`${prefix}Url`] as string | null;
  const latitude = toNumber(columns[`${prefix}Latitude`] as DecimalLike);
  const longitude = toNumber(columns[`${prefix}Longitude`] as DecimalLike);

  return {
    name,
    address,
    latitude,
    longitude,
    placeId,
    mapsUrl: url ?? buildMapsUrl(name, address, latitude, longitude, placeId)
  };
}
