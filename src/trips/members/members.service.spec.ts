import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { MembersService } from "./members.service";
import { MembersRepository } from "./members.repository";
import { TripAccessService } from "../trip-access.service";
import { UsersService } from "src/users/users.service";

const mockTripAccess = { getTrip: jest.fn() };

const mockMembersRepository = {
  findOwner: jest.fn(),
  findManyByTrip: jest.fn(),
  findByTripAndUser: jest.fn(),
  create: jest.fn(),
  updateRole: jest.fn(),
  delete: jest.fn(),
  transferOwnership: jest.fn()
};

const mockUsersService = { findByUsername: jest.fn() };

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

// owner of the trip is "owner"
const trip = { id: "t1", userId: "owner" };

const user = (id: string, username: string) => ({
  id,
  username,
  name: null,
  avatar: null
});

const membership = (userId: string, role: "EDITOR" | "VIEWER") => ({
  id: `m-${userId}`,
  tripId: "t1",
  userId,
  role,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  user: user(userId, `name-${userId}`)
});

describe("MembersService", () => {
  let service: MembersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: TripAccessService, useValue: mockTripAccess },
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: UsersService, useValue: mockUsersService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<MembersService>(MembersService);
    mockTripAccess.getTrip.mockResolvedValue({ trip, role: "OWNER" });
  });

  describe("list", () => {
    it("should list owner first then collaborators", async () => {
      mockMembersRepository.findOwner.mockResolvedValue(user("owner", "john"));
      mockMembersRepository.findManyByTrip.mockResolvedValue([
        membership("u2", "EDITOR")
      ]);

      const result = await service.list("u2", "t1");

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith("u2", "t1");
      expect(result.map((m) => [m.userId, m.role])).toEqual([
        ["owner", "OWNER"],
        ["u2", "EDITOR"]
      ]);
      expect(result[0].joinedAt).toBeNull();
    });
  });

  describe("add", () => {
    const activeUser = {
      id: "u2",
      username: "jane",
      isActive: true,
      deletedAt: null
    };

    it("should add user as collaborator (owner only)", async () => {
      mockUsersService.findByUsername.mockResolvedValue(activeUser);
      mockMembersRepository.create.mockResolvedValue(
        membership("u2", "VIEWER")
      );

      const result = await service.add("owner", "t1", {
        username: "jane",
        role: "VIEWER"
      });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "OWNER"
      );
      expect(mockMembersRepository.create).toHaveBeenCalledWith(
        "t1",
        "u2",
        "VIEWER"
      );
      expect(result.role).toBe("VIEWER");
    });

    it.each([
      ["not found", null],
      ["inactive", { ...activeUser, isActive: false }],
      ["deleted", { ...activeUser, deletedAt: new Date() }]
    ])("should throw NotFoundException when user is %s", async (_, found) => {
      mockUsersService.findByUsername.mockResolvedValue(found);

      await expect(
        service.add("owner", "t1", { username: "jane", role: "VIEWER" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should reject adding the owner", async () => {
      mockUsersService.findByUsername.mockResolvedValue({
        ...activeUser,
        id: "owner"
      });

      await expect(
        service.add("owner", "t1", { username: "john", role: "EDITOR" })
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockMembersRepository.create).not.toHaveBeenCalled();
    });

    it("should reject adding an existing member", async () => {
      mockUsersService.findByUsername.mockResolvedValue(activeUser);
      mockMembersRepository.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.add("owner", "t1", { username: "jane", role: "EDITOR" })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("updateRole", () => {
    it("should change role of a member (owner only)", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(
        membership("u2", "VIEWER")
      );
      mockMembersRepository.updateRole.mockResolvedValue(
        membership("u2", "EDITOR")
      );

      const result = await service.updateRole("owner", "t1", "u2", {
        role: "EDITOR"
      });

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "OWNER"
      );
      expect(mockMembersRepository.updateRole).toHaveBeenCalledWith(
        "m-u2",
        "EDITOR"
      );
      expect(result.role).toBe("EDITOR");
    });

    it("should throw NotFoundException when user is not a member", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(null);

      await expect(
        service.updateRole("owner", "t1", "u9", { role: "EDITOR" })
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should let owner remove a member", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(
        membership("u2", "EDITOR")
      );

      await service.remove("owner", "t1", "u2");

      expect(mockMembersRepository.delete).toHaveBeenCalledWith("m-u2");
    });

    it("should let a member leave the trip", async () => {
      mockTripAccess.getTrip.mockResolvedValue({ trip, role: "VIEWER" });
      mockMembersRepository.findByTripAndUser.mockResolvedValue(
        membership("u2", "VIEWER")
      );

      await service.remove("u2", "t1", "u2");

      expect(mockMembersRepository.delete).toHaveBeenCalledWith("m-u2");
    });

    it("should forbid a member removing someone else", async () => {
      mockTripAccess.getTrip.mockResolvedValue({ trip, role: "EDITOR" });

      await expect(service.remove("u2", "t1", "u3")).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(mockMembersRepository.delete).not.toHaveBeenCalled();
    });

    it.each([
      ["owner", "OWNER"],
      ["u2", "EDITOR"]
    ])(
      "should reject removing the owner (requested by %s)",
      async (requester, role) => {
        mockTripAccess.getTrip.mockResolvedValue({ trip, role });

        await expect(
          service.remove(requester, "t1", "owner")
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockMembersRepository.delete).not.toHaveBeenCalled();
      }
    );
  });

  describe("transferOwnership", () => {
    beforeEach(() => {
      mockMembersRepository.findOwner.mockResolvedValue(user("u2", "jane"));
      mockMembersRepository.findManyByTrip.mockResolvedValue([
        membership("owner", "EDITOR")
      ]);
    });

    it("should hand the trip to a member (owner only)", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(
        membership("u2", "VIEWER")
      );
      mockMembersRepository.transferOwnership.mockResolvedValue(true);

      const result = await service.transferOwnership("owner", "t1", "u2");

      expect(mockTripAccess.getTrip).toHaveBeenCalledWith(
        "owner",
        "t1",
        "OWNER"
      );
      expect(mockMembersRepository.transferOwnership).toHaveBeenCalledWith(
        "t1",
        "owner",
        "u2"
      );
      expect(result.map((m) => [m.userId, m.role])).toEqual([
        ["u2", "OWNER"],
        ["owner", "EDITOR"]
      ]);
    });

    it("should reject a user who is not a member", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(null);

      await expect(
        service.transferOwnership("owner", "t1", "u9")
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockMembersRepository.transferOwnership).not.toHaveBeenCalled();
    });

    it("should reject transferring to the current owner", async () => {
      await expect(
        service.transferOwnership("owner", "t1", "owner")
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should report a concurrent ownership change", async () => {
      mockMembersRepository.findByTripAndUser.mockResolvedValue(
        membership("u2", "EDITOR")
      );
      mockMembersRepository.transferOwnership.mockResolvedValue(false);

      await expect(
        service.transferOwnership("owner", "t1", "u2")
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
