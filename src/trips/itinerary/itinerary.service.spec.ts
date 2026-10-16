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
import { AccommodationsRepository } from "../accommodations/accommodations.repository";
import { TransportsRepository } from "../transports/transports.repository";
import { toLocationColumns } from "../location";

const mockAccommodationsRepository = { findManyByTrip: jest.fn() };
const mockTransportsRepository = { findManyByTrip: jest.fn() };

const mockTripAccess = {
  getTrip: jest.fn()
};

const mockItineraryRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  findManyByTripAndDay: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  nextPosition: jest.fn(),
  reorder: jest.fn()
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
        {
          provide: AccommodationsRepository,
          useValue: mockAccommodationsRepository
        },
        { provide: TransportsRepository, useValue: mockTransportsRepository },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<ItineraryService>(ItineraryService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
    mockItineraryRepository.nextPosition.mockResolvedValue(4);
    mockAccommodationsRepository.findManyByTrip.mockResolvedValue([]);
    mockTransportsRepository.findManyByTrip.mockResolvedValue([]);
  });

  describe("accommodations and transports per day", () => {
    // trip days: 2026-11-30, 2026-12-01, 2026-12-02
    const stay = (id: string, checkIn: string, checkOut: string) => ({
      id,
      tripId: "t1",
      name: id,
      ...toLocationColumns(null),
      checkInDate: new Date(`${checkIn}T00:00:00.000Z`),
      checkOutDate: new Date(`${checkOut}T00:00:00.000Z`),
      bookingCode: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const move = (id: string, departure: string, arrival: string | null) => ({
      id,
      tripId: "t1",
      type: "FLIGHT",
      carrier: null,
      number: null,
      ...toLocationColumns({ name: "A" }, "origin"),
      ...toLocationColumns({ name: "B" }, "destination"),
      departureAt: new Date(`${departure}:00.000Z`),
      arrivalAt: arrival ? new Date(`${arrival}:00.000Z`) : null,
      bookingCode: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    it("should place stays and transports on the right days", async () => {
      mockItineraryRepository.findManyByTrip.mockResolvedValue([]);
      mockAccommodationsRepository.findManyByTrip.mockResolvedValue([
        stay("hotel-a", "2026-11-30", "2026-12-01"),
        stay("hotel-b", "2026-12-01", "2026-12-03")
      ]);
      mockTransportsRepository.findManyByTrip.mockResolvedValue([
        move("arrive", "2026-11-30T09:00", "2026-11-30T12:00"),
        // overnight: departs day 2, arrives day 3
        move("night-bus", "2026-12-01T22:00", "2026-12-02T06:00")
      ]);

      const { days } = await service.getItinerary("u1", "t1");

      const summary = days.map((day) => [
        day.date,
        day.accommodations.map((a) => `${a.accommodation.name}:${a.event}`),
        day.transports.map((t) => t.id)
      ]);

      expect(summary).toEqual([
        ["2026-11-30", ["hotel-a:CHECK_IN"], ["arrive"]],
        // check-out listed before check-in on a hotel change day
        [
          "2026-12-01",
          ["hotel-a:CHECK_OUT", "hotel-b:CHECK_IN"],
          ["night-bus"]
        ],
        ["2026-12-02", ["hotel-b:STAY"], ["night-bus"]]
      ]);
    });

    it("should include stays and transports for a single day", async () => {
      mockItineraryRepository.findManyByTripAndDay.mockResolvedValue([]);
      mockAccommodationsRepository.findManyByTrip.mockResolvedValue([
        stay("hotel-b", "2026-12-01", "2026-12-03")
      ]);

      const day = await service.getDay("u1", "t1", 3);

      expect(day.accommodations).toEqual([
        expect.objectContaining({ event: "STAY" })
      ]);
      expect(day.transports).toEqual([]);
    });
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
        position: 4,
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

      // moved to the end of day 3
      expect(mockItineraryRepository.nextPosition).toHaveBeenCalledWith(
        "t1",
        3
      );
      expect(mockItineraryRepository.update).toHaveBeenCalledWith("i1", {
        dayNumber: 3,
        position: 4
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

  describe("reorderDay", () => {
    const A = "aaaaaaaa-0000-4000-8000-000000000001";
    const B = "aaaaaaaa-0000-4000-8000-000000000002";

    it("should save the new order of the day", async () => {
      mockItineraryRepository.findManyByTripAndDay.mockResolvedValue([
        makeItem({ id: A }),
        makeItem({ id: B })
      ]);

      await service.reorderDay("u1", "t1", 1, { itemIds: [B, A] });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u1", "t1", "EDITOR");
      expect(mockItineraryRepository.reorder).toHaveBeenCalledWith("t1", [
        B,
        A
      ]);
    });

    it.each([
      ["missing an item", [A]],
      ["containing an item of another day", [A, B, "other"]]
    ])("should reject a list %s", async (_, itemIds) => {
      mockItineraryRepository.findManyByTripAndDay.mockResolvedValue([
        makeItem({ id: A }),
        makeItem({ id: B })
      ]);

      await expect(
        service.reorderDay("u1", "t1", 1, { itemIds })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockItineraryRepository.reorder).not.toHaveBeenCalled();
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
