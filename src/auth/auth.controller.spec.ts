import { Test, TestingModule } from "@nestjs/testing";
import {
  UnauthorizedException,
  InternalServerErrorException
} from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ValidationService } from "src/common/validation/validation.service";
import { RegisterUserDto, LoginUserDto } from "./auth.validation";
import { AuthUserResponse } from "./models";

// =====================
// MOCKS
// =====================

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn()
};

const mockValidationService = {
  // pipe hanya akan memanggil validate(schema, value)
  // di controller unit test, kita tidak peduli schema
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  validate: jest.fn((_, value) => value)
};

// =====================
// CONSTANTS
// =====================

const DEVICE_ID = "test-device-id";

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

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService
        },
        {
          // 🔑 ValidationPipe butuh ValidationService
          provide: ValidationService,
          useValue: mockValidationService
        }
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // =====================
  // register
  // =====================
  describe("register", () => {
    it("should register user and return wrapped response", async () => {
      const dto = makeRegisterDto();

      const serviceResult: AuthUserResponse = {
        user: { id: "1", username: "john" },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      };

      mockAuthService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto, DEVICE_ID);

      expect(result).toEqual({ data: serviceResult });
      expect(mockAuthService.register).toHaveBeenCalledWith({
        ...dto,
        deviceId: DEVICE_ID
      });
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it("should propagate error thrown by AuthService", async () => {
      const dto = makeRegisterDto();

      const error = new Error("Something went wrong");
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(dto, DEVICE_ID)).rejects.toThrow(error);
    });
  });

  // =====================
  // login
  // =====================
  describe("login", () => {
    it("should login user and return wrapped response", async () => {
      const dto = makeLoginDto();

      const serviceResult: AuthUserResponse = {
        user: { id: "1", username: "john" },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      };

      mockAuthService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(dto, DEVICE_ID);

      expect(result).toEqual({ data: serviceResult });
      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...dto,
        deviceId: DEVICE_ID
      });
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it("should propagate UnauthorizedException from AuthService", async () => {
      const dto = makeLoginDto();

      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException("Invalid username or password")
      );

      await expect(controller.login(dto, DEVICE_ID)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it("should propagate InternalServerErrorException from AuthService", async () => {
      const dto = makeLoginDto();

      mockAuthService.login.mockRejectedValue(
        new InternalServerErrorException("Login failed")
      );

      await expect(controller.login(dto, DEVICE_ID)).rejects.toBeInstanceOf(
        InternalServerErrorException
      );
    });

    it("should propagate unknown error from AuthService", async () => {
      const dto = makeLoginDto();

      const error = new Error("Unexpected error");
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(dto, DEVICE_ID)).rejects.toThrow(error);
    });
  });
});
