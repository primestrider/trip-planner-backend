import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { TripsService } from "./trips.service";
import { TripsRepository } from "./trips.repository";
import { ItineraryRepository } from "./itinerary/itinerary.repository";
import { ChecklistRepository } from "./checklist/checklist.repository";
import { TripAccessService } from "./trip-access.service";
import { ActivityPublisher } from "./activity/activity.events";

const mockActivity = { publish: jest.fn() };

const mockItineraryRepository = {
  findMaxDayNumber: jest.fn(),
  findManyByTrip: jest.fn()
};

const mockChecklistRepository = {
  findManyByTrip: jest.fn()
};

const mockTripsRepository = {
  create: jest.fn(),
  findByIdForUser: jest.fn(),
  findManyForUser: jest.fn(),
  createWithContent: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const trip = {
  id: "t1",
  userId: "u1",
  title: "Bali",
  destination: "Bali, Indonesia",
  description: null,
  coverImageUrl: null,
  startDate: new Date("2026-11-01T00:00:00.000Z"),
  endDate: new Date("2026-11-05T00:00:00.000Z"),
  currency: "IDR",
  budgetAmount: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z")
};

// trip as loaded for its owner / for a collaborator
const ownedTrip = { ...trip, members: [] };
// trip owned by someone else where the user is a collaborator
const asMember = (role: "EDITOR" | "VIEWER") => ({
  ...trip,
  userId: "other-owner",
  members: [{ role }]
});

const tripResponse = {
  id: "t1",
  title: "Bali",
  destination: "Bali, Indonesia",
  description: null,
  coverImageUrl: null,
  startDate: "2026-11-01",
  endDate: "2026-11-05",
  currency: "IDR",
  budgetAmount: null,
  role: "OWNER",
  createdAt: trip.createdAt,
  updatedAt: trip.updatedAt
};

describe("TripsService", () => {
  let service: TripsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        TripAccessService,
        { provide: TripsRepository, useValue: mockTripsRepository },
        { provide: ItineraryRepository, useValue: mockItineraryRepository },
        { provide: ChecklistRepository, useValue: mockChecklistRepository },
        { provide: ActivityPublisher, useValue: mockActivity },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<TripsService>(TripsService);
    mockItineraryRepository.findMaxDayNumber.mockResolvedValue(null);
  });

  describe("create", () => {
    it("should create trip for user and format dates", async () => {
      mockTripsRepository.create.mockResolvedValue(trip);

      const result = await service.create("u1", {
        title: "Bali",
        destination: "Bali, Indonesia",
        startDate: "2026-11-01",
        endDate: "2026-11-05"
      });

      expect(mockTripsRepository.create).toHaveBeenCalledWith({
        userId: "u1",
        title: "Bali",
        destination: "Bali, Indonesia",
        description: null,
        coverImageUrl: null,
        startDate: trip.startDate,
        endDate: trip.endDate,
        budgetAmount: null
      });
      expect(result).toEqual(tripResponse);
      expect(result).not.toHaveProperty("userId");
    });
  });

  describe("findAll", () => {
    it("should paginate trips of user", async () => {
      mockTripsRepository.findManyForUser.mockResolvedValue({
        items: [ownedTrip, asMember("VIEWER")],
        total: 21
      });

      const result = await service.findAll("u1", {
        page: 2,
        limit: 10,
        order: "desc"
      });

      expect(mockTripsRepository.findManyForUser).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({
          order: "desc",
          today: expect.any(Date) as Date
        }),
        10,
        10
      );
      expect(result).toEqual({
        items: [tripResponse, { ...tripResponse, role: "VIEWER" }],
        meta: { page: 2, limit: 10, total: 21, totalPages: 3 }
      });
    });
  });

  describe("findAll filters", () => {
    it("should pass filters and use the client's local date", async () => {
      mockTripsRepository.findManyForUser.mockResolvedValue({
        items: [],
        total: 0
      });

      await service.findAll("u1", {
        page: 1,
        limit: 20,
        q: "bali",
        status: "upcoming",
        role: "shared",
        order: "asc",
        today: "2026-11-30"
      });

      expect(mockTripsRepository.findManyForUser).toHaveBeenCalledWith(
        "u1",
        {
          q: "bali",
          status: "upcoming",
          role: "shared",
          order: "asc",
          today: new Date("2026-11-30T00:00:00.000Z")
        },
        0,
        20
      );
    });
  });

  describe("findOne", () => {
    it("should return trip owned by user", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);

      await expect(service.findOne("u1", "t1")).resolves.toEqual(tripResponse);
      expect(mockTripsRepository.findByIdForUser).toHaveBeenCalledWith(
        "t1",
        "u1"
      );
    });

    it("should return trip with role of a collaborator", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(asMember("VIEWER"));

      const result = await service.findOne("u2", "t1");

      expect(result.role).toBe("VIEWER");
    });

    it("should throw NotFoundException when user has no access", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(service.findOne("u2", "t1")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe("update", () => {
    it("should update only provided fields", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);
      mockTripsRepository.update.mockResolvedValue({
        ...trip,
        title: "Lombok"
      });

      const result = await service.update("u1", "t1", { title: "Lombok" });

      expect(mockTripsRepository.update).toHaveBeenCalledWith("t1", {
        title: "Lombok"
      });
      expect(result.title).toBe("Lombok");
    });

    it("should allow editor to update", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(asMember("EDITOR"));
      mockTripsRepository.update.mockResolvedValue(trip);

      const result = await service.update("u2", "t1", { title: "x" });

      expect(result.role).toBe("EDITOR");
    });

    it("should forbid viewer to update", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(asMember("VIEWER"));

      await expect(
        service.update("u2", "t1", { title: "x" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockTripsRepository.update).not.toHaveBeenCalled();
    });

    it("should reject end date before stored start date", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);

      await expect(
        service.update("u1", "t1", { endDate: "2026-10-30" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockTripsRepository.update).not.toHaveBeenCalled();
    });

    it("should reject shortening trip below last planned day", async () => {
      // trip is 5 days, itinerary has items on day 4
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);
      mockItineraryRepository.findMaxDayNumber.mockResolvedValue(4);

      await expect(
        service.update("u1", "t1", { endDate: "2026-11-03" })
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockTripsRepository.update).not.toHaveBeenCalled();
    });

    it("should allow shifting trip dates keeping its length", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);
      mockItineraryRepository.findMaxDayNumber.mockResolvedValue(5);
      mockTripsRepository.update.mockResolvedValue(trip);

      await service.update("u1", "t1", {
        startDate: "2026-12-01",
        endDate: "2026-12-05"
      });

      expect(mockTripsRepository.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException when trip is not owned", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(
        service.update("u2", "t1", { title: "x" })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockTripsRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete trip owned by user", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);

      await service.remove("u1", "t1");

      expect(mockTripsRepository.delete).toHaveBeenCalledWith("t1");
    });

    it("should forbid editor to delete trip", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(asMember("EDITOR"));

      await expect(service.remove("u2", "t1")).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockTripsRepository.delete).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when trip is not owned", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(service.remove("u2", "t1")).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mockTripsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("duplicate", () => {
    const item = {
      id: "i1",
      tripId: "t1",
      dayNumber: 2,
      position: 1,
      title: "Beach",
      description: null,
      locationName: "Kuta",
      locationAddress: null,
      locationLatitude: null,
      locationLongitude: null,
      locationPlaceId: "ChIJ1",
      locationUrl: null,
      startTime: "09:00",
      endTime: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const checklistItem = {
      id: "c1",
      tripId: "t1",
      title: "Passport",
      category: "Documents",
      assignedToUserId: "u2",
      isChecked: true,
      checkedAt: new Date(),
      checkedByUserId: "u2"
    };

    beforeEach(() => {
      mockItineraryRepository.findManyByTrip.mockResolvedValue([item]);
      mockChecklistRepository.findManyByTrip.mockResolvedValue([checklistItem]);
      mockTripsRepository.createWithContent.mockImplementation(
        (data: Record<string, unknown>) =>
          Promise.resolve({ ...trip, id: "t2", ...data })
      );
    });

    it("should copy trip content into a new trip of the user", async () => {
      // viewer of someone else's trip
      mockTripsRepository.findByIdForUser.mockResolvedValue(asMember("VIEWER"));

      const result = await service.duplicate("u2", "t1", {
        startDate: "2027-01-10"
      });

      expect(mockTripsRepository.createWithContent).toHaveBeenCalledWith({
        userId: "u2",
        title: "Bali (copy)",
        destination: "Bali, Indonesia",
        description: null,
        coverImageUrl: null,
        // 5-day trip keeps its length
        startDate: new Date("2027-01-10T00:00:00.000Z"),
        endDate: new Date("2027-01-14T00:00:00.000Z"),
        currency: "IDR",
        budgetAmount: null,
        itineraryItems: [
          expect.objectContaining({
            dayNumber: 2,
            position: 1,
            title: "Beach",
            locationPlaceId: "ChIJ1",
            startTime: "09:00"
          })
        ],
        // checklist copied unchecked and unassigned
        checklistItems: [{ title: "Passport", category: "Documents" }]
      });
      expect(result).toMatchObject({
        id: "t2",
        role: "OWNER",
        startDate: "2027-01-10",
        endDate: "2027-01-14"
      });
    });

    it("should keep the original dates and use a custom title", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(ownedTrip);

      await service.duplicate("u1", "t1", { title: "Bali lagi" });

      expect(mockTripsRepository.createWithContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Bali lagi",
          startDate: trip.startDate,
          endDate: trip.endDate
        })
      );
    });

    it("should throw NotFoundException without access", async () => {
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(service.duplicate("u9", "t1", {})).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mockTripsRepository.createWithContent).not.toHaveBeenCalled();
    });
  });
});
