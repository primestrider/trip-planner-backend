import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { ChecklistService } from "./checklist.service";
import { ChecklistRepository } from "./checklist.repository";
import { MembersRepository } from "../members/members.repository";
import { TripAccessService } from "../trip-access.service";
import { ActivityPublisher } from "../activity/activity.events";

const mockActivity = { publish: jest.fn() };

const mockTripAccess = { getTrip: jest.fn() };
const mockChecklistRepository = {
  create: jest.fn(),
  findByIdAndTrip: jest.fn(),
  findManyByTrip: jest.fn(),
  countByTrip: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};
const mockMembersRepository = { findParticipantIds: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const MEMBER = "f7b3c1a2-0000-4000-8000-000000000001";
const OUTSIDER = "f7b3c1a2-0000-4000-8000-000000000009";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  tripId: "t1",
  title: "Passport",
  category: "Documents",
  assignedToUserId: null,
  assignedTo: null,
  isChecked: false,
  checkedAt: null,
  checkedByUserId: null,
  checkedBy: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides
});

describe("ChecklistService", () => {
  let service: ChecklistService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: ChecklistRepository, useValue: mockChecklistRepository },
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: ActivityPublisher, useValue: mockActivity },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<ChecklistService>(ChecklistService);
    mockTripAccess.getTrip.mockResolvedValue({
      trip: { id: "t1", userId: "owner" },
      role: "OWNER"
    });
    mockMembersRepository.findParticipantIds.mockResolvedValue([
      "owner",
      MEMBER
    ]);
  });

  it("should list items with overall progress", async () => {
    mockChecklistRepository.findManyByTrip.mockResolvedValue([item()]);
    mockChecklistRepository.countByTrip.mockResolvedValue({
      total: 3,
      checked: 2
    });

    const result = await service.list("u2", "t1", { checked: "false" });

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u2", "t1");
    expect(mockChecklistRepository.findManyByTrip).toHaveBeenCalledWith(
      "t1",
      false
    );
    expect(result).toMatchObject({ total: 3, checked: 2 });
    expect(result.items[0]).toMatchObject({ title: "Passport" });
  });

  it("should assign an item to a trip member", async () => {
    mockChecklistRepository.create.mockResolvedValue(item());

    await service.create("owner", "t1", {
      title: "Passport",
      assignedToUserId: MEMBER
    });

    expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
      "owner",
      "t1",
      "EDITOR"
    );
    expect(mockChecklistRepository.create).toHaveBeenCalledWith({
      tripId: "t1",
      title: "Passport",
      category: null,
      assignedToUserId: MEMBER
    });
  });

  it("should reject assigning someone outside the trip", async () => {
    await expect(
      service.create("owner", "t1", {
        title: "Passport",
        assignedToUserId: OUTSIDER
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockChecklistRepository.create).not.toHaveBeenCalled();
  });

  it("should not change items when user is only a viewer", async () => {
    mockTripAccess.getTrip.mockRejectedValue(new ForbiddenException());

    await expect(
      service.update("u2", "t1", "c1", { isChecked: true })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe("ticking", () => {
    it("should record who checked the item", async () => {
      mockChecklistRepository.findByIdAndTrip.mockResolvedValue(item());
      mockChecklistRepository.update.mockResolvedValue(item());

      await service.update("owner", "t1", "c1", { isChecked: true });

      expect(mockChecklistRepository.update).toHaveBeenCalledWith("c1", {
        isChecked: true,
        checkedAt: expect.any(Date) as Date,
        checkedByUserId: "owner"
      });
    });

    it("should clear who checked it when unticked", async () => {
      mockChecklistRepository.findByIdAndTrip.mockResolvedValue(
        item({ isChecked: true, checkedByUserId: MEMBER })
      );
      mockChecklistRepository.update.mockResolvedValue(item());

      await service.update("owner", "t1", "c1", { isChecked: false });

      expect(mockChecklistRepository.update).toHaveBeenCalledWith("c1", {
        isChecked: false,
        checkedAt: null,
        checkedByUserId: null
      });
    });

    it("should keep the original checker when ticked again", async () => {
      mockChecklistRepository.findByIdAndTrip.mockResolvedValue(
        item({ isChecked: true, checkedByUserId: MEMBER })
      );
      mockChecklistRepository.update.mockResolvedValue(item());

      await service.update("owner", "t1", "c1", { isChecked: true });

      expect(mockChecklistRepository.update).toHaveBeenCalledWith("c1", {});
      expect(mockActivity.publish).not.toHaveBeenCalled();
    });
  });

  it("should throw NotFoundException for item of another trip", async () => {
    mockChecklistRepository.findByIdAndTrip.mockResolvedValue(null);

    await expect(service.remove("owner", "t1", "c9")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
