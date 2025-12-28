import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateRefreshToken } from "./models";

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
  async deleteByUserAndDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.userAccessToken.deleteMany({
      where: {
        userId,
        deviceId
      }
    });
  }
}
