import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { ItineraryService } from "./itinerary.service";
import { ItineraryRepository } from "./itinerary.repository";
import { TripAccessService } from "../trip-access.service";

const mockTripAccess = {
  getTrip: jest.fn()
};

const mockItineraryRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  findManyByTripAndDay: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// 3-day trip: 2026-11-30, 2026-12-01, 2026-12-02 (crosses a month)
const trip = {
  id: "t1",
  userId: "u1",
  title: "Bali",
  destination: "Bali",
  description: null,
  startDate: new Date("2026-11-30T00:00:00.000Z"),
  endDate: new Date("2026-12-02T00:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date()
};

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  tripId: "t1",
  dayNumber: 1,
  title: "Beach",
  description: null,
  locationName: null,
  locationAddress: null,
  locationLatitude: null,
  locationLongitude: null,
  locationPlaceId: null,
  locationUrl: null,
  startTime: "09:00",
  endTime: "11:00",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides
});

describe("ItineraryService", () => {
  let service: ItineraryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItineraryService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: ItineraryRepository, useValue: mockItineraryRepository },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<ItineraryService>(ItineraryService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
  });

  it("should propagate NotFoundException when trip is not owned", async () => {
    mockTripAccess.getTrip.mockRejectedValue(
      new NotFoundException("Trip not found")
    );

    await expect(service.getItinerary("u2", "t1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mockItineraryRepository.findManyByTrip).not.toHaveBeenCalled();
  });

  it("should require EDITOR access to change itinerary", async () => {
    mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());
    mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());

    await expect(
      service.createItem("u2", "t1", { dayNumber: 1, title: "x" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateItem("u2", "t1", "i1", { title: "x" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteItem("u2", "t1", "i1")).rejects.toBeInstanceOf(
      ForbiddenException
    );

    expect(mockTripAccess.getTrip.mock.calls).toEqual([
      ["u2", "t1", "EDITOR"],
      ["u2", "t1", "EDITOR"],
      ["u2", "t1", "EDITOR"]
    ]);
    expect(mockItineraryRepository.create).not.toHaveBeenCalled();
    expect(mockItineraryRepository.update).not.toHaveBeenCalled();
    expect(mockItineraryRepository.delete).not.toHaveBeenCalled();
  });

  describe("getItinerary", () => {
    it("should group items per day including empty days", async () => {
      mockItineraryRepository.findManyByTrip.mockResolvedValue([
        makeItem({ id: "a", dayNumber: 1 }),
        makeItem({ id: "b", dayNumber: 3 })
      ]);

      const result = await service.getItinerary("u1", "t1");

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u1", "t1");
      expect(result.totalDays).toBe(3);
      expect(
        result.days.map((day) => [
          day.dayNumber,
          day.date,
          day.items.map((item) => item.id)
        ])
      ).toEqual([
        [1, "2026-11-30", ["a"]],
        [2, "2026-12-01", []],
        [3, "2026-12-02", ["b"]]
      ]);
      expect(result.days[0].items[0]).not.toHaveProperty("tripId");
    });
  });

  describe("getDay", () => {
    it("should return items of the day with its date", async () => {
      mockItineraryRepository.findManyByTripAndDay.mockResolvedValue([
        makeItem({ dayNumber: 2 })
      ]);

      const result = await service.getDay("u1", "t1", 2);

      expect(mockItineraryRepository.findManyByTripAndDay).toHaveBeenCalledWith(
        "t1",
        2
      );
      expect(result.date).toBe("2026-12-01");
      expect(result.items).toHaveLength(1);
    });

    it.each([0, 4])("should reject day %d outside trip", async (day) => {
      await expect(service.getDay("u1", "t1", day)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });

  describe("createItem", () => {
    it("should create item on a day of the trip", async () => {
      mockItineraryRepository.create.mockResolvedValue(makeItem());

      await service.createItem("u1", "t1", { dayNumber: 1, title: "Beach" });

      expect(mockItineraryRepository.create).toHaveBeenCalledWith({
        tripId: "t1",
        dayNumber: 1,
        title: "Beach",
        description: null,
        locationName: null,
        locationAddress: null,
        locationLatitude: null,
        locationLongitude: null,
        locationPlaceId: null,
        locationUrl: null,
        startTime: null,
        endTime: null
      });
    });

    it("should store location picked from Google Maps", async () => {
      mockItineraryRepository.create.mockResolvedValue(
        makeItem({
          locationName: "Tanah Lot",
          locationLatitude: -8.621213,
          locationLongitude: 115.086807,
          locationPlaceId: "ChIJabc"
        })
      );

      const result = await service.createItem("u1", "t1", {
        dayNumber: 1,
        title: "Sunset",
        location: {
          name: "Tanah Lot",
          latitude: -8.621213,
          longitude: 115.086807,
          placeId: "ChIJabc"
        }
      });

      expect(mockItineraryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          locationName: "Tanah Lot",
          locationAddress: null,
          locationLatitude: -8.621213,
          locationLongitude: 115.086807,
          locationPlaceId: "ChIJabc",
          locationUrl: null
        })
      );
      expect(result.location).toEqual({
        name: "Tanah Lot",
        address: null,
        latitude: -8.621213,
        longitude: 115.086807,
        placeId: "ChIJabc",
        mapsUrl:
          "https://www.google.com/maps/search/?api=1&query=-8.621213%2C115.086807&query_place_id=ChIJabc"
      });
    });

    it("should reject day after trip end", async () => {
      await expect(
        service.createItem("u1", "t1", { dayNumber: 4, title: "Beach" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockItineraryRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateItem", () => {
    it("should move item to another day", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());
      mockItineraryRepository.update.mockResolvedValue(
        makeItem({ dayNumber: 3 })
      );

      const result = await service.updateItem("u1", "t1", "i1", {
        dayNumber: 3
      });

      expect(mockItineraryRepository.update).toHaveBeenCalledWith("i1", {
        dayNumber: 3
      });
      expect(result.dayNumber).toBe(3);
    });

    it("should reject end time before stored start time", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());

      await expect(
        service.updateItem("u1", "t1", "i1", { endTime: "08:00" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockItineraryRepository.update).not.toHaveBeenCalled();
    });

    it("should clear every location column when location is null", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());
      mockItineraryRepository.update.mockResolvedValue(makeItem());

      const result = await service.updateItem("u1", "t1", "i1", {
        location: null
      });

      expect(mockItineraryRepository.update).toHaveBeenCalledWith("i1", {
        locationName: null,
        locationAddress: null,
        locationLatitude: null,
        locationLongitude: null,
        locationPlaceId: null,
        locationUrl: null
      });
      expect(result.location).toBeNull();
    });

    it("should allow clearing start time", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());
      mockItineraryRepository.update.mockResolvedValue(
        makeItem({ startTime: null })
      );

      await service.updateItem("u1", "t1", "i1", { startTime: null });

      expect(mockItineraryRepository.update).toHaveBeenCalledWith("i1", {
        startTime: null
      });
    });

    it("should throw NotFoundException when item is not in trip", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(null);

      await expect(
        service.updateItem("u1", "t1", "i1", { title: "x" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("deleteItem", () => {
    it("should delete item of the trip", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(makeItem());

      await service.deleteItem("u1", "t1", "i1");

      expect(mockItineraryRepository.findByIdAndTrip).toHaveBeenCalledWith(
        "i1",
        "t1"
      );
      expect(mockItineraryRepository.delete).toHaveBeenCalledWith("i1");
    });

    it("should throw NotFoundException when item is not in trip", async () => {
      mockItineraryRepository.findByIdAndTrip.mockResolvedValue(null);

      await expect(service.deleteItem("u1", "t1", "i1")).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mockItineraryRepository.delete).not.toHaveBeenCalled();
    });
  });
});
