import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateRefreshToken } from "./models";
import { UserAccessToken } from "@prisma/client";

/**
 * Repository responsible for managing refresh tokens
 * stored in the user_access_tokens table.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Store a hashed refresh token.
   */
  async create(payload: CreateRefreshToken) {
    return this.prisma.userAccessToken.create({
      data: payload
    });
  }

  /**
   *  Remove existing refresh token for the same user & device
   */
  async deleteTokenByUserAndDevice(
    userId: string,
    deviceId: string
  ): Promise<void> {
    await this.prisma.userAccessToken.deleteMany({
      where: {
        userId,
        deviceId
      }
    });
  }

  /**
   * Remove all refresh token for user
   */
  async deleteAllTokenUser(userId: string): Promise<void> {
    await this.prisma.userAccessToken.deleteMany({
      where: {
        userId: userId
      }
    });
  }

  /**
   * Remove refresh token for user by id
   * @param id
   */
  async deleteTokenById(id: string): Promise<void> {
    await this.prisma.userAccessToken.delete({
      where: { id }
    });
  }

  /**
   * Find an active refresh token record for a user
   * and device.
   *
   * Used during refresh token validation.
   *
   * @param userId User identifier
   * @param deviceId Device identifier
   * @returns Refresh token record or null if not found
   */
  async findByUserAndDevice(
    userId: string,
    deviceId: string
  ): Promise<UserAccessToken | null> {
    return this.prisma.userAccessToken.findFirst({
      where: {
        userId: userId,
        deviceId: deviceId
      }
    });
  }

  /**
   * Rotate (update) an existing refresh token.
   *
   * This invalidates the previous refresh token
   * and replaces it with a new one.
   *
   * @param tokenId
   * @param tokenHash
   * @param expiresAt
   */
  async updateRefreshToken(
    tokenId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    await this.prisma.userAccessToken.update({
      where: { id: tokenId },
      data: {
        tokenHash: tokenHash,
        expiresAt: expiresAt
      }
    });
  }
}
