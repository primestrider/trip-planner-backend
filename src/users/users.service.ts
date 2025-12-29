import {
  ConflictException,
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
  async findUserBydId(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
}
