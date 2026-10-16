import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { UsersRepository } from "./users.repository";
import { User } from "@prisma/client";
import { AvatarResponse, UserProfileResponse } from "./models";
import { UpdateProfileDto } from "./users.validation";

/**
 * UsersService contains domain-level business logic related to user management.
 *
 * This service is responsible for enforcing user-related rules such as
 * username uniqueness and user creation, while delegating data persistence
 * to the UsersRepository.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async ensureUsernameNotExists(username: string): Promise<void> {
    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      throw new ConflictException("Username already exists");
    }
  }

  /**
   * Create a new user.
   *
   * Includes defensive error handling to translate database-level
   * uniqueness violations into a domain-level ConflictException.
   */
  async create(data: { username: string; password: string }) {
    try {
      return await this.usersRepository.create(data);
    } catch (error: unknown) {
      // Narrow error type safely
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Username already exists");
      }

      throw new InternalServerErrorException("Failed to create user");
    }
  }

  /**
   * Find a user by user ID.
   *
   * Used in authentication flows such as refresh token
   * to retrieve user information safely.
   *
   * @param userId User ID
   * @returns User entity
   * @throws NotFoundException if user does not exist
   */
  async findUserById(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  /**
   * Check whether the user account is locked.
   *
   * @throws ForbiddenException
   */
  ensureAccountNotLocked(user: User): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw new ForbiddenException("Account is temporarily locked");
    }
  }

  /**
   * Increade failed login user attempt
   * @param userId
   */
  async increaseFailedLogin(userId: string): Promise<void> {
    const user = await this.findUserById(userId);

    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MS = 15 * 60 * 1000;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentAttempts: number = user.failedLoginAttempts ?? 0;
    const nextFailedAttempts: number = currentAttempts + 1;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const lockUntil: Date | null =
      nextFailedAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : user.lockUntil;

    await this.usersRepository.update(userId, {
      failedLoginAttempts: nextFailedAttempts,
      lockUntil
    });
  }

  /**
   * Reset failed login attempts after successful login.
   *
   * This should be called by AuthService after login success.
   */
  async resetFailedLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      failedLoginAttempts: 0,
      lockUntil: null
    });
  }

  /**
   * Update last login for user
   * @param userId
   */
  async updatelastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date()
    });
  }

  /**
   * Get profile of an active user.
   *
   * @throws NotFoundException if user does not exist, is inactive or deleted
   */
  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.usersRepository.findByIdWithAvatar(userId);

    if (!user || !user.isActive || user.deletedAt) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }

  /**
   * Update name and/or avatar of the user profile.
   * Passing `null` clears the field.
   *
   * @throws NotFoundException if user is not available
   * @throws BadRequestException if avatar does not exist or is inactive
   */
  async updateProfile(
    userId: string,
    payload: UpdateProfileDto
  ): Promise<UserProfileResponse> {
    await this.getProfile(userId);

    if (payload.avatarId != null) {
      const avatar = await this.usersRepository.findActiveAvatarById(
        payload.avatarId
      );

      if (!avatar) {
        throw new BadRequestException("Avatar not found");
      }
    }

    await this.usersRepository.update(userId, {
      name: payload.name,
      avatarId: payload.avatarId
    });

    return this.getProfile(userId);
  }

  /**
   * List avatars available for selection.
   */
  async getAvatars(): Promise<AvatarResponse[]> {
    return this.usersRepository.findActiveAvatars();
  }
}
