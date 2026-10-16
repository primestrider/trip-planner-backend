import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { ShareService } from "./share.service";
import { TripAccessService } from "../trip-access.service";
import { TripsRepository } from "../trips.repository";
import { ItineraryService } from "../itinerary/itinerary.service";
import { toLocationResponse, toLocationColumns } from "../location";

const mockTripAccess = { getTrip: jest.fn() };
const mockTripsRepository = { update: jest.fn(), findByShareToken: jest.fn() };
const mockItineraryService = { buildItinerary: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const TOKEN = "b".repeat(32);

const trip = {
  id: "t1",
  userId: "owner",
  title: "Bali",
  destination: "Bali",
  description: null,
  coverImageUrl: "https://example.com/cover.jpg",
  shareToken: null as string | null,
  startDate: new Date("2026-11-30T00:00:00.000Z"),
  endDate: new Date("2026-12-01T00:00:00.000Z")
};

describe("ShareService", () => {
  let service: ShareService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: TripsRepository, useValue: mockTripsRepository },
        { provide: ItineraryService, useValue: mockItineraryService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<ShareService>(ShareService);
  });

  describe("managing the link (owner only)", () => {
    it("should create a token when sharing is off", async () => {
      mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });

      const result = await service.enable("owner", "t1", {
        regenerate: false
      });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "OWNER"
      );
      expect(result.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(mockTripsRepository.update).toHaveBeenCalledWith("t1", {
        shareToken: result.token
      });
    });

    it("should keep the existing link unless regenerated", async () => {
      mockTripAccess.getTrip.mockResolvedValue({
        trip: { ...trip, shareToken: TOKEN },
        role: "OWNER"
      });

      const kept = await service.enable("owner", "t1", { regenerate: false });
      expect(kept.token).toBe(TOKEN);
      expect(mockTripsRepository.update).not.toHaveBeenCalled();

      const replaced = await service.enable("owner", "t1", {
        regenerate: true
      });
      expect(replaced.token).not.toBe(TOKEN);
      expect(mockTripsRepository.update).toHaveBeenCalledTimes(1);
    });

    it("should clear the token when disabled", async () => {
      mockTripAccess.getTrip.mockResolvedValue({
        trip: { ...trip, shareToken: TOKEN },
        role: "OWNER"
      });

      await expect(service.disable("owner", "t1")).resolves.toEqual({
        enabled: false,
        token: null
      });
      expect(mockTripsRepository.update).toHaveBeenCalledWith("t1", {
        shareToken: null
      });
    });

    it("should not let an editor manage the link", async () => {
      mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());

      await expect(
        service.enable("u2", "t1", { regenerate: false })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("getPublicTrip", () => {
    it.each([
      ["malformed", "short", undefined],
      ["unknown or disabled", TOKEN, null]
    ])("should throw NotFoundException when %s", async (_, token, found) => {
      mockTripsRepository.findByShareToken.mockResolvedValue(found);

      await expect(service.getPublicTrip(token)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("should hide private data", async () => {
      mockTripsRepository.findByShareToken.mockResolvedValue({
        ...trip,
        shareToken: TOKEN
      });
      const location = toLocationResponse({
        ...toLocationColumns({ name: "Hotel" })
      });
      mockItineraryService.buildItinerary.mockResolvedValue({
        tripId: "t1",
        startDate: "2026-11-30",
        endDate: "2026-12-01",
        totalDays: 2,
        days: [
          {
            dayNumber: 1,
            date: "2026-11-30",
            items: [
              {
                id: "i1",
                dayNumber: 1,
                title: "Beach",
                description: null,
                location: null,
                startTime: "09:00",
                endTime: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ],
            accommodations: [
              {
                event: "CHECK_IN",
                accommodation: {
                  id: "a1",
                  name: "Hotel",
                  location,
                  checkInDate: "2026-11-30",
                  checkOutDate: "2026-12-01",
                  nights: 1,
                  bookingCode: "SECRET-1",
                  notes: "room 12"
                }
              }
            ],
            transports: [
              {
                id: "x1",
                type: "FLIGHT",
                carrier: "GA",
                number: "404",
                origin: null,
                destination: null,
                departureAt: "2026-11-30T09:00",
                arrivalAt: null,
                bookingCode: "SECRET-2",
                notes: "seat 1A"
              }
            ]
          }
        ]
      });

      const result = await service.getPublicTrip(TOKEN);
      const json = JSON.stringify(result);

      expect(result.trip).toMatchObject({
        title: "Bali",
        coverImageUrl: "https://example.com/cover.jpg",
        totalDays: 2
      });
      expect(result.days[0].accommodations[0]).toEqual({
        event: "CHECK_IN",
        name: "Hotel",
        location,
        checkInDate: "2026-11-30",
        checkOutDate: "2026-12-01"
      });
      for (const secret of ["SECRET-1", "SECRET-2", "room 12", "seat 1A"]) {
        expect(json).not.toContain(secret);
      }
      expect(json).not.toContain("owner");
      expect(json).not.toContain("shareToken");
    });
  });
});
