import { createHash } from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { InvitesService } from "./invites.service";
import { InvitesRepository } from "./invites.repository";
import { TripAccessService } from "../trip-access.service";
import { TripsRepository } from "../trips.repository";
import { ActivityPublisher } from "../activity/activity.events";

const mockActivity = { publish: jest.fn() };

const mockTripAccess = { getTrip: jest.fn() };
const mockTripsRepository = { findByIdForUser: jest.fn() };
const mockInvitesRepository = {
  create: jest.fn(),
  findManyByTrip: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findByTokenHash: jest.fn(),
  revoke: jest.fn(),
  redeem: jest.fn()
};
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const TOKEN = "a".repeat(43);
const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

const invite = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  tripId: "t1",
  tokenHash: "hash",
  role: "VIEWER",
  expiresAt: future,
  maxUses: null,
  useCount: 0,
  revokedAt: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  trip: {
    id: "t1",
    title: "Bali",
    destination: "Bali",
    startDate: new Date("2026-11-30T00:00:00.000Z"),
    endDate: new Date("2026-12-03T00:00:00.000Z"),
    user: { username: "john", name: null }
  },
  ...overrides
});

describe("InvitesService", () => {
  let service: InvitesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: TripsRepository, useValue: mockTripsRepository },
        { provide: InvitesRepository, useValue: mockInvitesRepository },
        { provide: ActivityPublisher, useValue: mockActivity },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<InvitesService>(InvitesService);
    mockTripAccess.getTrip.mockResolvedValue({
      trip: { id: "t1", userId: "owner" },
      role: "OWNER"
    });
  });

  describe("create", () => {
    it("should return the token once and store only its hash", async () => {
      mockInvitesRepository.create.mockImplementation((data) =>
        Promise.resolve({ ...invite(), ...data })
      );

      const result = await service.create("owner", "t1", {
        role: "EDITOR",
        expiresInDays: 7
      });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "OWNER"
      );
      expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const [[stored]] = mockInvitesRepository.create.mock.calls as [
        [{ tokenHash: string; maxUses: number | null }]
      ];
      expect(stored.tokenHash).toBe(
        createHash("sha256").update(result.token).digest("hex")
      );
      expect(stored).not.toHaveProperty("token");
      expect(stored.maxUses).toBeNull();
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("preview / accept with unusable link", () => {
    it.each([
      ["malformed token", "short", null],
      ["unknown token", TOKEN, null],
      ["revoked", TOKEN, invite({ revokedAt: new Date() })],
      ["expired", TOKEN, invite({ expiresAt: new Date(Date.now() - 1000) })],
      ["used up", TOKEN, invite({ maxUses: 2, useCount: 2 })]
    ])("should throw NotFoundException when %s", async (_, token, found) => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(found);

      await expect(service.preview("u2", token)).rejects.toBeInstanceOf(
        NotFoundException
      );
      await expect(service.accept("u2", token)).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(mockInvitesRepository.redeem).not.toHaveBeenCalled();
    });
  });

  describe("preview", () => {
    it("should show trip and current role", async () => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(invite());
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);

      const result = await service.preview("u2", TOKEN);

      expect(result).toMatchObject({
        trip: { title: "Bali", startDate: "2026-11-30" },
        invitedBy: { username: "john" },
        role: "VIEWER",
        currentRole: null
      });
    });
  });

  describe("accept", () => {
    it("should join the trip with the invite role", async () => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(invite());
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);
      mockInvitesRepository.redeem.mockResolvedValue(true);

      const result = await service.accept("u2", TOKEN);

      expect(mockInvitesRepository.redeem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "i1", tripId: "t1" }),
        "u2",
        "VIEWER"
      );
      expect(result).toEqual({
        tripId: "t1",
        role: "VIEWER",
        alreadyMember: false
      });
    });

    it("should keep existing role and not use the invite", async () => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(
        invite({ role: "VIEWER" })
      );
      mockTripsRepository.findByIdForUser.mockResolvedValue({
        id: "t1",
        userId: "owner",
        members: [{ role: "EDITOR" }]
      });

      const result = await service.accept("u2", TOKEN);

      expect(result).toEqual({
        tripId: "t1",
        role: "EDITOR",
        alreadyMember: true
      });
      expect(mockInvitesRepository.redeem).not.toHaveBeenCalled();
    });

    it("should fail when the last use was taken concurrently", async () => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(invite());
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);
      mockInvitesRepository.redeem.mockResolvedValue(false);

      await expect(service.accept("u2", TOKEN)).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("should report conflict when user joined concurrently", async () => {
      mockInvitesRepository.findByTokenHash.mockResolvedValue(invite());
      mockTripsRepository.findByIdForUser.mockResolvedValue(null);
      mockInvitesRepository.redeem.mockRejectedValue({ code: "P2002" });

      await expect(service.accept("u2", TOKEN)).rejects.toBeInstanceOf(
        ConflictException
      );
    });
  });

  describe("revoke", () => {
    it("should throw NotFoundException for invite of another trip", async () => {
      mockInvitesRepository.findByIdAndTrip.mockResolvedValue(null);

      await expect(service.revoke("owner", "t1", "i9")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it("should not revoke twice", async () => {
      mockInvitesRepository.findByIdAndTrip.mockResolvedValue(
        invite({ revokedAt: new Date() })
      );

      const result = await service.revoke("owner", "t1", "i1");

      expect(result.status).toBe("REVOKED");
      expect(mockInvitesRepository.revoke).not.toHaveBeenCalled();
    });
  });
});
