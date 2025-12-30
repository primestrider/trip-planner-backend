import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { UsersRepository } from "./users.repository";
import { User } from "@prisma/client";

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
}
