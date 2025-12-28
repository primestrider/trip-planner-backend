import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateUserAccessToken } from "./models";

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
  async create(payload: CreateUserAccessToken) {
    return this.prisma.userAccessToken.create({
      data: payload
    });
  }
}
