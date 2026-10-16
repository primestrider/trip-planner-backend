import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { ValidationService } from "src/common/validation/validation.service";
import { UpdateProfileSchema } from "./users.validation";

const mockUsersService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  getAvatars: jest.fn()
};

describe("UsersController", () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        ValidationService
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it("should return profile of current user", async () => {
    const profile = { id: "u1", username: "john" };
    mockUsersService.getProfile.mockResolvedValue(profile);

    await expect(controller.getProfile("u1")).resolves.toEqual(profile);
    expect(mockUsersService.getProfile).toHaveBeenCalledWith("u1");
  });

  it("should update profile of current user", async () => {
    const profile = { id: "u1", username: "john", name: "John" };
    mockUsersService.updateProfile.mockResolvedValue(profile);

    await expect(
      controller.updateProfile("u1", { name: "John" })
    ).resolves.toEqual(profile);
    expect(mockUsersService.updateProfile).toHaveBeenCalledWith("u1", {
      name: "John"
    });
  });

  it("should return avatars", async () => {
    const avatars = [{ id: 1, url: "https://example.com/1" }];
    mockUsersService.getAvatars.mockResolvedValue(avatars);

    await expect(controller.getAvatars()).resolves.toEqual(avatars);
  });
});

describe("UpdateProfileSchema", () => {
  it.each([
    [{ name: "  John  " }, { name: "John" }],
    [
      { name: null, avatarId: null },
      { name: null, avatarId: null }
    ],
    [{ avatarId: 2 }, { avatarId: 2 }]
  ])("should accept %j", (input, expected) => {
    expect(UpdateProfileSchema.parse(input)).toEqual(expected);
  });

  it.each([
    {},
    { name: "" },
    { avatarId: 0 },
    { avatarId: "1" },
    { role: "ADMIN" },
    { name: "x".repeat(101) }
  ])("should reject %j", (input) => {
    expect(UpdateProfileSchema.safeParse(input).success).toBe(false);
  });
});
