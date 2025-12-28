import {
  ConflictException,
  Injectable,
  InternalServerErrorException
} from "@nestjs/common";
import { UsersRepository } from "./users.repository";

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
}
