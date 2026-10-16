import {
  CreateItineraryItemSchema,
  UpdateItineraryItemSchema
} from "./itinerary.validation";

describe("CreateItineraryItemSchema", () => {
  it.each([
    { dayNumber: 1, title: "Beach" },
    {
      dayNumber: 2,
      title: "Dinner",
      location: {
        name: "Ku De Ta",
        placeId: "ChIJ123",
        latitude: -8.68,
        longitude: 115.15
      },
      startTime: "19:00",
      endTime: "21:30"
    },
    { dayNumber: 1, title: "Check in", startTime: "14:00", endTime: null }
  ])("should accept %j", (input) => {
    expect(CreateItineraryItemSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { title: "Beach" },
    { dayNumber: 0, title: "Beach" },
    { dayNumber: 1.5, title: "Beach" },
    { dayNumber: 1, title: "" },
    { dayNumber: 1, title: "Beach", startTime: "9:00" },
    { dayNumber: 1, title: "Beach", startTime: "24:00" },
    { dayNumber: 1, title: "Beach", startTime: "10:00", endTime: "09:00" },
    { dayNumber: 1, title: "Beach", tripId: "other" }
  ])("should reject %j", (input) => {
    expect(CreateItineraryItemSchema.safeParse(input).success).toBe(false);
  });
});

describe("UpdateItineraryItemSchema", () => {
  it("should accept partial update", () => {
    expect(UpdateItineraryItemSchema.safeParse({ dayNumber: 2 }).success).toBe(
      true
    );
  });

  it.each([{}, { startTime: "12:00", endTime: "11:59" }])(
    "should reject %j",
    (input) => {
      expect(UpdateItineraryItemSchema.safeParse(input).success).toBe(false);
    }
  );
});
