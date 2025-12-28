import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  InternalServerErrorException
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";

// =====================
// MOCK REPOSITORY
// =====================

const mockUsersRepository = {
  findByUsername: jest.fn(),
  create: jest.fn()
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
});
