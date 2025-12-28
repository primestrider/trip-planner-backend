import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ValidationService } from "src/common/validation/validation.service";
import { RegisterUserDto } from "./auth.validation";
import { RegisterUserResponse } from "./models";

// =====================
// MOCKS
// =====================

const mockAuthService = {
  register: jest.fn()
};

const mockValidationService = {
  // pipe hanya akan memanggil validate(schema, value)
  // di controller unit test, kita tidak peduli schema
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  validate: jest.fn((_, value) => value)
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
          // 🔑 INI KUNCI UTAMA
          // ValidationPipe(RegisterSchema) butuh ValidationService
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

      const serviceResult: RegisterUserResponse = {
        user: {
          id: "1",
          username: "john"
        },
        accessToken: "access-token",
        refreshToken: "refresh-token"
      };

      mockAuthService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto);

      expect(result).toEqual({
        data: serviceResult
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it("should propagate error thrown by AuthService", async () => {
      const dto = makeRegisterDto();

      const error = new Error("Something went wrong");
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(dto)).rejects.toThrow(error);
    });
  });
});
