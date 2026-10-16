import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TripAccessService, TripRole } from "./trip-access.service";
import { TripsRepository } from "./trips.repository";

const mockTripsRepository = { findByIdForUser: jest.fn() };

const trip = { id: "t1", userId: "owner", title: "Bali" };

const loadedFor = (role: TripRole) =>
  role === "OWNER"
    ? { ...trip, members: [] }
    : { ...trip, members: [{ role }] };

describe("TripAccessService", () => {
  const service = new TripAccessService(
    mockTripsRepository as unknown as TripsRepository
  );

  beforeEach(() => jest.clearAllMocks());

  it("should throw NotFoundException when user cannot see the trip", async () => {
    mockTripsRepository.findByIdForUser.mockResolvedValue(null);

    await expect(service.getTrip("u9", "t1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("should return trip without membership data", async () => {
    mockTripsRepository.findByIdForUser.mockResolvedValue(loadedFor("OWNER"));

    const result = await service.getTrip("owner", "t1");

    expect(result).toEqual({ trip, role: "OWNER" });
    expect(mockTripsRepository.findByIdForUser).toHaveBeenCalledWith(
      "t1",
      "owner"
    );
  });

  // [role of user, required role, allowed]
  it.each<[TripRole, TripRole, boolean]>([
    ["VIEWER", "VIEWER", true],
    ["VIEWER", "EDITOR", false],
    ["VIEWER", "OWNER", false],
    ["EDITOR", "EDITOR", true],
    ["EDITOR", "OWNER", false],
    ["OWNER", "OWNER", true]
  ])("%s requesting %s access allowed=%s", async (role, minRole, allowed) => {
    mockTripsRepository.findByIdForUser.mockResolvedValue(loadedFor(role));
    const userId = role === "OWNER" ? "owner" : "u2";

    const result = service.getTrip(userId, "t1", minRole);

    if (allowed) {
      await expect(result).resolves.toMatchObject({ role });
    } else {
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
