import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

import { User, Prisma } from "@prisma/client";
import { UpdateUserModel } from "./models";

/**
 * UsersRepository
 *
 * Repository responsible for interacting with the `user` table
 * in the database.
 *
 * This layer handles only data persistence and retrieval,
 * and does not contain any business logic.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by its unique username.
   *
   * @param username Unique username of the user
   * @returns User record if found, otherwise `null`
   */
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  /**
   * Find a user by its unique identifier.
   *
   * @param userId Unique user ID
   * @returns User record if found, otherwise `null`
   */
  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId
      }
    });
  }

  /**
   * Create a new user record.
   *
   * @param data Object containing username and hashed password
   * @returns Newly created user record
   */
  async create(data: { username: string; password: string }) {
    return this.prisma.user.create({
      data
    });
  }

  /**
   * Update user to database
   * @param userId
   * @param payload
   * @returns
   */
  async update(userId: string, payload: UpdateUserModel): Promise<User> {
    const data: Prisma.UserUpdateArgs["data"] = {
      ...(payload.password && { password: payload.password }),
      ...(payload.passwordChangedAt && {
        passwordChangedAt: payload.passwordChangedAt
      }),
      ...(payload.failedLoginAttempts !== undefined && {
        failedLoginAttempts: payload.failedLoginAttempts
      }),
      ...(payload.lockUntil !== undefined && {
        lockUntil: payload.lockUntil
      }),
      ...(payload.lastLoginAt && {
        lastLoginAt: payload.lastLoginAt
      }),
      ...(payload.isActive !== undefined && {
        isActive: payload.isActive
      }),
      ...(payload.deletedAt !== undefined && {
        deletedAt: payload.deletedAt
      })
    };

    return this.prisma.user.update({
      where: { id: userId },
      data
    });
  }
}
