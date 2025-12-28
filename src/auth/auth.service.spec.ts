import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  InternalServerErrorException
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { AuthRepository } from "./auth.repository";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { RegisterUserDto } from "./auth.validation";

// =====================
// MOCK DEPENDENCIES
// =====================

const mockUsersService = {
  ensureUsernameNotExists: jest.fn(),
  create: jest.fn()
};

const mockAuthRepository = {
  create: jest.fn()
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
// HELPER
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

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

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

  // =====================
  // HAPPY PATH
  // =====================
  it("should register user successfully and return tokens", async () => {
    mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
    mockUsersService.create.mockResolvedValue({
      id: 1,
      username: "john"
    });

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

    mockJwtService.signAsync
      .mockResolvedValueOnce("access-token")
      .mockResolvedValueOnce("refresh-token");

    mockAuthRepository.create.mockResolvedValue(undefined);

    const result = await service.register(makeRegisterDto());

    expect(result).toEqual({
      user: {
        id: 1,
        username: "john"
      },
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });

    expect(mockUsersService.ensureUsernameNotExists).toHaveBeenCalledWith(
      "john"
    );
    expect(mockUsersService.create).toHaveBeenCalled();
    expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(mockAuthRepository.create).toHaveBeenCalled();
  });

  // =====================
  // USERNAME CONFLICT
  // =====================
  it("should throw ConflictException if username already exists", async () => {
    mockUsersService.ensureUsernameNotExists.mockRejectedValue(
      new ConflictException("Username already exists")
    );

    await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(
      ConflictException
    );

    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // =====================
  // CONFIG MISSING
  // =====================
  it("should throw error if JWT configuration is missing", async () => {
    mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
    mockUsersService.create.mockResolvedValue({
      id: 1,
      username: "john"
    });

    mockConfigService.get.mockReturnValue(undefined);

    await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  // =====================
  // INVALID EXPIRES FORMAT
  // =====================
  it("should throw error if JWT expires format is invalid", async () => {
    mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
    mockUsersService.create.mockResolvedValue({
      id: 1,
      username: "john"
    });

    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case "JWT_ACCESS_SECRET":
          return "secret";
        case "JWT_REFRESH_SECRET":
          return "secret";
        case "JWT_ACCESS_EXPIRES_IN":
          return "INVALID";
        case "JWT_REFRESH_EXPIRES_IN":
          return "30d";
        default:
          return undefined;
      }
    });

    await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  // =====================
  // JWT SIGN FAILURE
  // =====================
  it("should throw error if JWT signing fails", async () => {
    mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
    mockUsersService.create.mockResolvedValue({
      id: 1,
      username: "john"
    });

    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case "JWT_ACCESS_SECRET":
        case "JWT_REFRESH_SECRET":
          return "secret";
        case "JWT_ACCESS_EXPIRES_IN":
          return "1h";
        case "JWT_REFRESH_EXPIRES_IN":
          return "30d";
        default:
          return undefined;
      }
    });

    mockJwtService.signAsync.mockRejectedValue(new Error("JWT sign failed"));

    await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });

  // =====================
  // REPOSITORY FAILURE
  // =====================
  it("should throw error if refresh token save fails", async () => {
    mockUsersService.ensureUsernameNotExists.mockResolvedValue(undefined);
    mockUsersService.create.mockResolvedValue({
      id: 1,
      username: "john"
    });

    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case "JWT_ACCESS_SECRET":
        case "JWT_REFRESH_SECRET":
          return "secret";
        case "JWT_ACCESS_EXPIRES_IN":
          return "1h";
        case "JWT_REFRESH_EXPIRES_IN":
          return "30d";
        default:
          return undefined;
      }
    });

    mockJwtService.signAsync
      .mockResolvedValueOnce("access-token")
      .mockResolvedValueOnce("refresh-token");

    mockAuthRepository.create.mockRejectedValue(new Error("DB error"));

    await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(
      InternalServerErrorException
    );
  });
});
