/**
 * IMPORTANT:
 * bcrypt adalah native / CJS module
 * HARUS dimock via jest.mock
 */
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { AuthRepository } from "./auth.repository";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import * as bcrypt from "bcrypt";
import { RegisterUserDto, LoginUserDto } from "./auth.validation";

// =====================
// CONSTANTS
// =====================

const DEVICE_ID = "test-device-id";

// =====================
// MOCK DEPENDENCIES
// =====================

const mockUsersService = {
  ensureUsernameNotExists: jest.fn(),
  create: jest.fn(),
  findByUsername: jest.fn()
};

const mockAuthRepository = {
  create: jest.fn(),
  deleteByUserAndDevice: jest.fn()
};

const mockJwtService = {
  signAsync: jest.fn()
};

const mockConfigService = {
  get: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// =====================
// HELPERS
// =====================

function makeRegisterDto(
  overrides?: Partial<RegisterUserDto>
): RegisterUserDto {
  return {
    username: "john",
    password: "password123",
    confirmPassword: "password123",
    ...overrides
  };
}

function makeLoginDto(overrides?: Partial<LoginUserDto>): LoginUserDto {
  return {
    username: "john",
    password: "password123",
    ...overrides
  };
}

function mockJwtConfigValid() {
  mockConfigService.get.mockImplementation((key: string) => {
    switch (key) {
      case "JWT_ACCESS_SECRET":
        return "access-secret";
      case "JWT_REFRESH_SECRET":
        return "refresh-secret";
      case "JWT_ACCESS_EXPIRES_IN":
        return "1h";
      case "JWT_REFRESH_EXPIRES_IN":
        return "30d";
      default:
        return undefined;
    }
  });
}

// =====================
// TESTS
// =====================

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed");
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockLogger }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ======================================================
  // REGISTER
  // ======================================================

  describe("register", () => {
    it("should register user successfully and return tokens", async () => {
      mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
      mockUsersService.create.mockResolvedValue({
        id: 1,
        username: "john"
      });

      mockJwtConfigValid();

      mockJwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");

      mockAuthRepository.create.mockResolvedValue(undefined);

      const result = await service.register({
        ...makeRegisterDto(),
        deviceId: DEVICE_ID
      });

      expect(result).toEqual({
        user: { id: 1, username: "john" },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      });

      expect(mockAuthRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          deviceId: DEVICE_ID
        })
      );
    });

    it("should throw ConflictException if username already exists", async () => {
      mockUsersService.ensureUsernameNotExists.mockRejectedValue(
        new ConflictException("Username already exists")
      );

      await expect(
        service.register({ ...makeRegisterDto(), deviceId: DEVICE_ID })
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ======================================================
  // LOGIN
  // ======================================================

  describe("login", () => {
    it("should login user successfully and return tokens", async () => {
      mockUsersService.findByUsername.mockResolvedValue({
        id: 1,
        username: "john",
        password: "hashed-password"
      });

      mockJwtConfigValid();

      mockJwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");

      mockAuthRepository.create.mockResolvedValue(undefined);
      mockAuthRepository.deleteByUserAndDevice.mockResolvedValue(undefined);

      const result = await service.login({
        ...makeLoginDto(),
        deviceId: DEVICE_ID
      });

      expect(result).toEqual({
        user: { id: 1, username: "john" },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      });

      expect(mockAuthRepository.deleteByUserAndDevice).toHaveBeenCalledWith(
        1,
        DEVICE_ID
      );
    });

    it("should throw UnauthorizedException if user not found", async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({ ...makeLoginDto(), deviceId: DEVICE_ID })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should throw UnauthorizedException if password invalid", async () => {
      mockUsersService.findByUsername.mockResolvedValue({
        id: 1,
        username: "john",
        password: "hashed-password"
      });

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ ...makeLoginDto(), deviceId: DEVICE_ID })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should throw InternalServerErrorException if token save fails", async () => {
      mockUsersService.findByUsername.mockResolvedValue({
        id: 1,
        username: "john",
        password: "hashed-password"
      });

      mockJwtConfigValid();

      mockJwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");

      mockAuthRepository.deleteByUserAndDevice.mockResolvedValue(undefined);
      mockAuthRepository.create.mockRejectedValue(new Error("DB error"));

      await expect(
        service.login({ ...makeLoginDto(), deviceId: DEVICE_ID })
      ).rejects.toThrow(Error);
    });
  });
});
