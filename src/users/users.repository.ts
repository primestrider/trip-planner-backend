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
      }),
      ...(payload.name !== undefined && {
        name: payload.name
      }),
      ...(payload.avatarId !== undefined && {
        avatarId: payload.avatarId
      })
    };

    return this.prisma.user.update({
      where: { id: userId },
      data
    });
  }

  /**
   * Find a user by ID including its selected avatar.
   *
   * @param userId Unique user ID
   * @returns User record with avatar if found, otherwise `null`
   */
  async findByIdWithAvatar(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { avatar: { select: { id: true, url: true } } }
    });
  }

  /**
   * Find an active avatar by its ID.
   *
   * @param avatarId Avatar ID
   * @returns Avatar record if found and active, otherwise `null`
   */
  async findActiveAvatarById(avatarId: number) {
    return this.prisma.avatar.findFirst({
      where: { id: avatarId, isActive: true },
      select: { id: true, url: true }
    });
  }

  /**
   * List all active avatars ordered for display.
   */
  async findActiveAvatars() {
    return this.prisma.avatar.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true, url: true }
    });
  }
}
