import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { AuthRepository } from "./auth.repository";

/**
 * Scheduled housekeeping for authentication data.
 */
@Injectable()
export class AuthTasks {
  constructor(
    private readonly authRepository: AuthRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  /**
   * Delete refresh tokens that can no longer be used.
   * Runs daily at 03:17 (server time). Safe to run on several instances
   * at once: deleting already-deleted rows is a no-op.
   */
  @Cron("17 3 * * *", { name: "delete-expired-refresh-tokens" })
  async deleteExpiredRefreshTokens(): Promise<number> {
    const deleted = await this.authRepository.deleteExpired(new Date());

    this.logger.info("Expired refresh tokens deleted", { deleted });

    return deleted;
  }
}
