import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { ActivityRepository } from "./activity.repository";
import { TRIP_ACTIVITY_EVENT, type TripActivityEvent } from "./activity.events";

/**
 * Records trip activity events in the feed.
 *
 * Runs asynchronously after the action that emitted the event, so a
 * failure here is only logged: the user's action has already succeeded
 * and must not fail because the feed could not be written.
 */
@Injectable()
export class ActivityListener {
  constructor(
    private readonly activityRepository: ActivityRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  @OnEvent(TRIP_ACTIVITY_EVENT, { async: true })
  async record(event: TripActivityEvent): Promise<void> {
    try {
      await this.activityRepository.create(event);
    } catch (error: unknown) {
      this.logger.error("Failed to record trip activity", {
        tripId: event.tripId,
        action: event.action,
        error: error instanceof Error ? error.message : error
      });
    }
  }
}
