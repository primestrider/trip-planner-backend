import { Prisma } from "@prisma/client";
import {
  isGoogleMapsUrl,
  LocationSchema,
  toLocationColumns,
  toLocationResponse
} from "./location";

describe("isGoogleMapsUrl", () => {
  it.each([
    "https://maps.app.goo.gl/AbCdEf123",
    "https://goo.gl/maps/AbCdEf123",
    "https://www.google.com/maps/place/Tanah+Lot/@-8.62,115.08,17z",
    "https://google.co.id/maps/search/?api=1&query=bali",
    "https://maps.google.com/?q=-8.62,115.08"
  ])("should accept %s", (url) => {
    expect(isGoogleMapsUrl(url)).toBe(true);
  });

  it.each([
    "http://maps.app.goo.gl/AbCdEf123",
    "https://goo.gl/AbCdEf123",
    "https://www.google.com/search?q=bali",
    "https://google.com.evil.com/maps",
    "https://evil.com/maps.google.com",
    "https://maps.google.com.evil.com/",
    "javascript:alert(1)",
    "not a url"
  ])("should reject %s", (url) => {
    expect(isGoogleMapsUrl(url)).toBe(false);
  });
});

describe("LocationSchema", () => {
  it.each([
    { name: "Tanah Lot" },
    { name: "Tanah Lot", placeId: "ChIJabc" },
    { name: "Tanah Lot", latitude: -8.62, longitude: 115.08 },
    { name: "Tanah Lot", url: "https://maps.app.goo.gl/AbCdEf123" }
  ])("should accept %j", (input) => {
    expect(LocationSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    {},
    { name: "" },
    { name: "x", latitude: -8.62 },
    { name: "x", latitude: 91, longitude: 0 },
    { name: "x", latitude: 0, longitude: 181 },
    { name: "x", url: "https://example.com" },
    { name: "x", rating: 5 }
  ])("should reject %j", (input) => {
    expect(LocationSchema.safeParse(input).success).toBe(false);
  });
});

describe("toLocationResponse", () => {
  const empty = toLocationColumns(null);

  it("should return null when no location is stored", () => {
    expect(toLocationResponse(empty)).toBeNull();
  });

  it("should prefer the stored Google Maps link", () => {
    const result = toLocationResponse({
      ...empty,
      locationName: "Tanah Lot",
      locationUrl: "https://maps.app.goo.gl/AbCdEf123"
    });

    expect(result?.mapsUrl).toBe("https://maps.app.goo.gl/AbCdEf123");
  });

  it("should convert decimal coordinates to numbers", () => {
    const result = toLocationResponse({
      ...empty,
      locationName: "Tanah Lot",
      locationLatitude: new Prisma.Decimal("-8.621213"),
      locationLongitude: new Prisma.Decimal("115.086807")
    });

    expect(result?.latitude).toBe(-8.621213);
    expect(result?.longitude).toBe(115.086807);
  });

  it("should search by name and address when only a label is stored", () => {
    const result = toLocationResponse({
      ...empty,
      locationName: "Warung Babi Guling",
      locationAddress: "Ubud, Bali"
    });

    expect(result?.mapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=Warung+Babi+Guling%2C+Ubud%2C+Bali"
    );
  });
});
