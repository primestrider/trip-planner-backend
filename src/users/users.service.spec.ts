jest.mock("bcrypt", () => ({ compare: jest.fn() }));

import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";
import * as bcrypt from "bcrypt";

// =====================
// MOCK REPOSITORY
// =====================

const mockUsersRepository = {
  findByUsername: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findByIdWithAvatar: jest.fn(),
  findActiveAvatarById: jest.fn(),
  findActiveAvatars: jest.fn(),
  findById: jest.fn(),
  countOwnedTripsWithMembers: jest.fn(),
  softDelete: jest.fn()
};

const activeUser = {
  id: "u1",
  username: "john",
  password: "hashed",
  name: null,
  role: "USER",
  isActive: true,
  deletedAt: null,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  avatar: null
};

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository
        }
      ]
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // =====================
  // findByUsername
  // =====================
  describe("findByUsername", () => {
    it("should return user when found", async () => {
      const user = { id: 1, username: "john" };

      mockUsersRepository.findByUsername.mockResolvedValue(user);

      const result = await service.findByUsername("john");

      expect(result).toEqual(user);
      expect(mockUsersRepository.findByUsername).toHaveBeenCalledWith("john");
    });

    it("should return null when user not found", async () => {
      mockUsersRepository.findByUsername.mockResolvedValue(null);

      const result = await service.findByUsername("john");

      expect(result).toBeNull();
    });
  });

  // =====================
  // ensureUsernameNotExists
  // =====================
  describe("ensureUsernameNotExists", () => {
    it("should pass when username does not exist", async () => {
      mockUsersRepository.findByUsername.mockResolvedValue(null);

      await expect(
        service.ensureUsernameNotExists("john")
      ).resolves.toBeUndefined();
    });

    it("should throw ConflictException when username exists", async () => {
      mockUsersRepository.findByUsername.mockResolvedValue({
        id: 1,
        username: "john"
      });

      await expect(
        service.ensureUsernameNotExists("john")
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // =====================
  // create
  // =====================
  describe("create", () => {
    const createPayload = {
      username: "john",
      password: "hashed-password"
    };

    it("should create user successfully", async () => {
      const createdUser = { id: 1, ...createPayload };

      mockUsersRepository.create.mockResolvedValue(createdUser);

      const result = await service.create(createPayload);

      expect(result).toEqual(createdUser);
      expect(mockUsersRepository.create).toHaveBeenCalledWith(createPayload);
    });

    it("should throw ConflictException when unique constraint error occurs", async () => {
      mockUsersRepository.create.mockRejectedValue({
        code: "P2002"
      });

      await expect(service.create(createPayload)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it("should throw InternalServerErrorException for unknown errors", async () => {
      mockUsersRepository.create.mockRejectedValue(
        new Error("DB connection lost")
      );

      await expect(service.create(createPayload)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });
  });

  // =====================
  // getProfile
  // =====================
  describe("getProfile", () => {
    it("should return profile without sensitive fields", async () => {
      mockUsersRepository.findByIdWithAvatar.mockResolvedValue(activeUser);

      const result = await service.getProfile("u1");

      expect(result).toEqual({
        id: "u1",
        username: "john",
        name: null,
        role: "USER",
        avatar: null,
        lastLoginAt: null,
        createdAt: activeUser.createdAt
      });
      expect(result).not.toHaveProperty("password");
    });

    it.each([
      ["not found", null],
      ["inactive", { ...activeUser, isActive: false }],
      ["deleted", { ...activeUser, deletedAt: new Date() }]
    ])("should throw NotFoundException when user is %s", async (_, user) => {
      mockUsersRepository.findByIdWithAvatar.mockResolvedValue(user);

      await expect(service.getProfile("u1")).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  // =====================
  // updateProfile
  // =====================
  describe("updateProfile", () => {
    it("should update name and avatar when avatar is active", async () => {
      const avatar = { id: 3, url: "https://example.com/3" };
      mockUsersRepository.findByIdWithAvatar
        .mockResolvedValueOnce(activeUser)
        .mockResolvedValueOnce({ ...activeUser, name: "John", avatar });
      mockUsersRepository.findActiveAvatarById.mockResolvedValue(avatar);

      const result = await service.updateProfile("u1", {
        name: "John",
        avatarId: 3
      });

      expect(mockUsersRepository.update).toHaveBeenCalledWith("u1", {
        name: "John",
        avatarId: 3
      });
      expect(result.name).toBe("John");
      expect(result.avatar).toEqual(avatar);
    });

    it("should allow clearing avatar without avatar lookup", async () => {
      mockUsersRepository.findByIdWithAvatar.mockResolvedValue(activeUser);

      await service.updateProfile("u1", { avatarId: null });

      expect(mockUsersRepository.findActiveAvatarById).not.toHaveBeenCalled();
      expect(mockUsersRepository.update).toHaveBeenCalledWith("u1", {
        name: undefined,
        avatarId: null
      });
    });

    it("should throw BadRequestException when avatar is not available", async () => {
      mockUsersRepository.findByIdWithAvatar.mockResolvedValue(activeUser);
      mockUsersRepository.findActiveAvatarById.mockResolvedValue(null);

      await expect(
        service.updateProfile("u1", { avatarId: 99 })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockUsersRepository.update).not.toHaveBeenCalled();
    });
  });

  // =====================
  // getAvatars
  // =====================
  describe("getAvatars", () => {
    it("should return active avatars", async () => {
      const avatars = [{ id: 1, url: "https://example.com/1" }];
      mockUsersRepository.findActiveAvatars.mockResolvedValue(avatars);

      await expect(service.getAvatars()).resolves.toEqual(avatars);
    });
  });

  // =====================
  // findActiveById
  // =====================
  describe("findActiveById", () => {
    it.each([
      ["active", activeUser, true],
      ["inactive", { ...activeUser, isActive: false }, false],
      ["deleted", { ...activeUser, deletedAt: new Date() }, false],
      ["missing", null, false]
    ])("should handle %s users", async (_, user, found) => {
      mockUsersRepository.findById.mockResolvedValue(user);

      const result = await service.findActiveById("u1");

      expect(result !== null).toBe(found);
    });
  });

  // =====================
  // changePassword
  // =====================
  describe("changePassword", () => {
    it("should store the change time truncated to whole seconds", async () => {
      await service.changePassword("u1", "new-hash");

      const [[, data]] = mockUsersRepository.update.mock.calls as [
        [string, { password: string; passwordChangedAt: Date }]
      ];
      expect(data.password).toBe("new-hash");
      expect(data.passwordChangedAt.getMilliseconds()).toBe(0);
    });
  });

  // =====================
  // deleteAccount
  // =====================
  describe("deleteAccount", () => {
    beforeEach(() => {
      mockUsersRepository.findById.mockResolvedValue(activeUser);
    });

    it("should soft delete after confirming the password", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersRepository.countOwnedTripsWithMembers.mockResolvedValue(0);

      await service.deleteAccount("u1", "Passw0rd!");

      expect(mockUsersRepository.softDelete).toHaveBeenCalledWith("u1");
    });

    it("should reject a wrong password", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.deleteAccount("u1", "wrong")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(mockUsersRepository.softDelete).not.toHaveBeenCalled();
    });

    it("should refuse while owning trips with other members", async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersRepository.countOwnedTripsWithMembers.mockResolvedValue(2);

      await expect(
        service.deleteAccount("u1", "Passw0rd!")
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockUsersRepository.softDelete).not.toHaveBeenCalled();
    });
  });
});
