import { BadRequestException } from "@nestjs/common";
import { Logger } from "winston";
import { ActivityService } from "./activity.service";
import { ActivityRepository } from "./activity.repository";
import { ActivityListener } from "./activity.listener";
import { TripAccessService } from "../trip-access.service";

const mockTripAccess = {
  getTrip: jest.fn().mockResolvedValue({ trip: { id: "t1" }, role: "VIEWER" })
};
const mockRepository = { findPage: jest.fn(), create: jest.fn() };

const row = (id: string, at: string) => ({
  id,
  tripId: "t1",
  actorUserId: "u1",
  actor: { id: "u1", username: "john", name: null },
  action: "expense.added",
  data: { title: "Dinner" },
  createdAt: new Date(at)
});

describe("ActivityService", () => {
  const service = new ActivityService(
    mockTripAccess as unknown as TripAccessService,
    mockRepository as unknown as ActivityRepository
  );

  beforeEach(() => jest.clearAllMocks());

  it("should return a page and a cursor when more rows exist", async () => {
    // limit 2 -> repository asked for 3
    mockRepository.findPage.mockResolvedValue([
      row("c", "2026-11-30T10:00:03.000Z"),
      row("b", "2026-11-30T10:00:02.000Z"),
      row("a", "2026-11-30T10:00:01.000Z")
    ]);

    const page = await service.list("u2", "t1", { limit: 2 });

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u2", "t1");
    expect(mockRepository.findPage).toHaveBeenCalledWith("t1", null, 3);
    expect(page.items.map((item) => item.id)).toEqual(["c", "b"]);
    expect(page.items[0]).toMatchObject({
      action: "expense.added",
      actor: { userId: "u1", username: "john" }
    });
    expect(page.nextCursor).toEqual(expect.any(String));

    // the cursor points at the last returned row
    await service.list("u2", "t1", { limit: 2, cursor: page.nextCursor! });
    expect(mockRepository.findPage).toHaveBeenLastCalledWith(
      "t1",
      { createdAt: new Date("2026-11-30T10:00:02.000Z"), id: "b" },
      3
    );
  });

  it("should return no cursor on the last page", async () => {
    mockRepository.findPage.mockResolvedValue([
      row("a", "2026-11-30T10:00:01.000Z")
    ]);

    const page = await service.list("u2", "t1", { limit: 2 });

    expect(page.nextCursor).toBeNull();
  });

  it.each(["not-base64-json", Buffer.from("[1,2]").toString("base64url")])(
    "should reject a cursor not issued by the API (%s)",
    async (cursor) => {
      await expect(
        service.list("u2", "t1", { limit: 2, cursor })
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  );
});

describe("ActivityListener", () => {
  const logger = { error: jest.fn() };
  const listener = new ActivityListener(
    mockRepository as unknown as ActivityRepository,
    logger as unknown as Logger
  );
  const event = {
    tripId: "t1",
    actorUserId: "u1",
    action: "expense.added" as const
  };

  beforeEach(() => jest.clearAllMocks());

  it("should store the event", async () => {
    mockRepository.create.mockResolvedValue(undefined);

    await listener.record(event);

    expect(mockRepository.create).toHaveBeenCalledWith(event);
  });

  it("should log instead of failing when storing fails", async () => {
    mockRepository.create.mockRejectedValue(new Error("db down"));

    await expect(listener.record(event)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to record trip activity",
      expect.objectContaining({ tripId: "t1", action: "expense.added" })
    );
  });
});
