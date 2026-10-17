import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodQuery } from "src/common/validation/zod.decorators";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { ActivityService } from "./activity.service";
import {
  type ListActivityQuery,
  ListActivityQuerySchema
} from "./activity.validation";
import { type ActivityPageResponse } from "./models";

@ApiTags("activity")
@Controller("trips/:tripId/activity")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Activity feed of a trip, newest first (cursor pagination)
   *  GET /trips/:tripId/activity?limit=20&cursor=...
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodQuery(ListActivityQuerySchema) query: ListActivityQuery
  ): Promise<ActivityPageResponse> {
    return this.activityService.list(userId, tripId, query);
  }
}
