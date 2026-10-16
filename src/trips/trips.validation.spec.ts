import {
  CreateTripSchema,
  ListTripsQuerySchema,
  UpdateTripSchema
} from "./trips.validation";

const validTrip = {
  title: "Bali",
  destination: "Bali, Indonesia",
  startDate: "2026-11-01",
  endDate: "2026-11-05"
};

describe("CreateTripSchema", () => {
  it("should accept valid trip and allow same-day trip", () => {
    expect(CreateTripSchema.safeParse(validTrip).success).toBe(true);
    expect(
      CreateTripSchema.safeParse({ ...validTrip, endDate: "2026-11-01" })
        .success
    ).toBe(true);
  });

  it.each([
    { ...validTrip, title: "" },
    { ...validTrip, destination: undefined },
    { ...validTrip, startDate: "01-11-2026" },
    { ...validTrip, endDate: "2026-02-30" },
    { ...validTrip, endDate: "2026-10-31" },
    { ...validTrip, userId: "someone-else" }
  ])("should reject %j", (input) => {
    expect(CreateTripSchema.safeParse(input).success).toBe(false);
  });
});

describe("UpdateTripSchema", () => {
  it("should accept partial update", () => {
    expect(UpdateTripSchema.safeParse({ description: null }).success).toBe(
      true
    );
  });

  it.each([
    {},
    { startDate: "2026-11-05", endDate: "2026-11-01" },
    { title: "   " }
  ])("should reject %j", (input) => {
    expect(UpdateTripSchema.safeParse(input).success).toBe(false);
  });
});

describe("ListTripsQuerySchema", () => {
  it("should apply defaults and coerce strings", () => {
    expect(ListTripsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      order: "desc"
    });
    expect(ListTripsQuerySchema.parse({ page: "2", limit: "5" })).toEqual({
      page: 2,
      limit: 5,
      order: "desc"
    });
  });

  it.each([
    { page: "0" },
    { limit: "101" },
    { page: "abc" },
    { status: "soon" },
    { role: "admin" },
    { order: "up" },
    { today: "30-11-2026" }
  ])("should reject %j", (input) => {
    expect(ListTripsQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe("CreateTripSchema budget", () => {
  it("should normalize currency and accept budget", () => {
    expect(
      CreateTripSchema.parse({
        ...validTrip,
        currency: " usd ",
        budgetAmount: 1500.25
      })
    ).toMatchObject({ currency: "USD", budgetAmount: 1500.25 });
  });

  it.each([
    { ...validTrip, currency: "RUPIAH" },
    { ...validTrip, currency: "U1" },
    { ...validTrip, budgetAmount: -1 },
    { ...validTrip, budgetAmount: 10.001 }
  ])("should reject %j", (input) => {
    expect(CreateTripSchema.safeParse(input).success).toBe(false);
  });
});

describe("CreateTripSchema cover image", () => {
  it("should accept an https image URL or null", () => {
    for (const coverImageUrl of [
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200",
      null
    ]) {
      expect(
        CreateTripSchema.safeParse({ ...validTrip, coverImageUrl }).success
      ).toBe(true);
    }
  });

  it.each([
    "http://example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "not a url"
  ])("should reject %s", (coverImageUrl) => {
    expect(
      CreateTripSchema.safeParse({ ...validTrip, coverImageUrl }).success
    ).toBe(false);
  });
});
