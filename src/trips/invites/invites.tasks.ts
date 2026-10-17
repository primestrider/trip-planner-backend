import { Inject, Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { InvitesRepository } from "./invites.repository";
import { addDays } from "src/utils/date";

// expired / revoked invites stay visible to the owner this long
const KEEP_INACTIVE_DAYS = 30;

/**
 * Scheduled housekeeping for invite links.
 */
@Injectable()
export class InvitesTasks {
  constructor(
    private readonly invitesRepository: InvitesRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  /**
   * Delete invites that expired or were revoked more than 30 days ago.
   * Runs daily at 03:23 (server time); idempotent.
   */
  @Cron("23 3 * * *", { name: "delete-stale-invites" })
  async deleteStaleInvites(): Promise<number> {
    const cutoff = addDays(new Date(), -KEEP_INACTIVE_DAYS);
    const deleted = await this.invitesRepository.deleteInactiveBefore(cutoff);

    this.logger.info("Stale invites deleted", { deleted, cutoff });

    return deleted;
  }
}
