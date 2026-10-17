import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { AccommodationsService } from "./accommodations.service";
import { AccommodationsRepository } from "./accommodations.repository";
import { TripAccessService } from "../trip-access.service";
import { toLocationColumns } from "../location";
import { CreateAccommodationSchema } from "./accommodations.validation";
import { ActivityPublisher } from "../activity/activity.events";

const mockActivity = { publish: jest.fn() };

const mockTripAccess = { getTrip: jest.fn() };

const mockRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const trip = { id: "t1", userId: "owner" };

const accommodation = {
  id: "a1",
  tripId: "t1",
  name: "Hotel Kuta",
  ...toLocationColumns(null),
  locationName: "Hotel Kuta",
  checkInDate: new Date("2026-11-30T00:00:00.000Z"),
  checkOutDate: new Date("2026-12-03T00:00:00.000Z"),
  bookingCode: "ABC123",
  notes: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z")
};

describe("AccommodationsService", () => {
  let service: AccommodationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccommodationsService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: AccommodationsRepository, useValue: mockRepository },
        { provide: ActivityPublisher, useValue: mockActivity },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<AccommodationsService>(AccommodationsService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
  });

  it("should list accommodations with dates and nights", async () => {
    mockRepository.findManyByTrip.mockResolvedValue([accommodation]);

    const [result] = await service.list("u1", "t1");

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u1", "t1");
    expect(result).toMatchObject({
      name: "Hotel Kuta",
      checkInDate: "2026-11-30",
      checkOutDate: "2026-12-03",
      nights: 3,
      location: { name: "Hotel Kuta" }
    });
  });

  it("should create accommodation with EDITOR access", async () => {
    mockRepository.create.mockResolvedValue(accommodation);

    await service.create("u1", "t1", {
      name: "Hotel Kuta",
      location: { name: "Hotel Kuta", placeId: "ChIJ1" },
      checkInDate: "2026-11-30",
      checkOutDate: "2026-12-03"
    });

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u1", "t1", "EDITOR");
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: "t1",
        locationName: "Hotel Kuta",
        locationPlaceId: "ChIJ1",
        checkInDate: accommodation.checkInDate,
        bookingCode: null
      })
    );
  });

  it("should not create when user is only a viewer", async () => {
    mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create("u2", "t1", {
        name: "x",
        checkInDate: "2026-11-30",
        checkOutDate: "2026-12-01"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it("should reject check-out moved before stored check-in", async () => {
    mockRepository.findByIdAndTrip.mockResolvedValue(accommodation);

    await expect(
      service.update("u1", "t1", "a1", { checkOutDate: "2026-11-30" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException for accommodation of another trip", async () => {
    mockRepository.findByIdAndTrip.mockResolvedValue(null);

    await expect(service.remove("u1", "t1", "a9")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(mockRepository.findByIdAndTrip).toHaveBeenCalledWith("a9", "t1");
  });
});

describe("CreateAccommodationSchema", () => {
  const valid = {
    name: "Hotel",
    checkInDate: "2026-11-30",
    checkOutDate: "2026-12-01"
  };

  it("should accept a one-night stay", () => {
    expect(CreateAccommodationSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    { ...valid, checkOutDate: "2026-11-30" },
    { ...valid, name: "" },
    { ...valid, tripId: "x" }
  ])("should reject %j", (input) => {
    expect(CreateAccommodationSchema.safeParse(input).success).toBe(false);
  });
});
