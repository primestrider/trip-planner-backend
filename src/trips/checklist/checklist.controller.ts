import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodBody, ZodQuery } from "src/common/validation/zod.decorators";
import { ChecklistService } from "./checklist.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type CreateChecklistItemDto,
  type ListChecklistQuery,
  type UpdateChecklistItemDto,
  CreateChecklistItemSchema,
  ListChecklistQuerySchema,
  UpdateChecklistItemSchema
} from "./checklist.validation";
import { type ChecklistItemResponse, type ChecklistResponse } from "./models";

@ApiTags("checklist")
@Controller("trips/:tripId/checklist")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  /**
   * List checklist items with progress
   *  GET /trips/:tripId/checklist?checked=false
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodQuery(ListChecklistQuerySchema) query: ListChecklistQuery
  ): Promise<ChecklistResponse> {
    return this.checklistService.list(userId, tripId, query);
  }

  /**
   * Add a checklist item
   *  POST /trips/:tripId/checklist
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodBody(CreateChecklistItemSchema)
    body: CreateChecklistItemDto
  ): Promise<ChecklistItemResponse> {
    return this.checklistService.create(userId, tripId, body);
  }

  /**
   * Update or tick / untick a checklist item
   *  PATCH /trips/:tripId/checklist/:itemId
   */
  @Patch(":itemId")
  async update(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @ZodBody(UpdateChecklistItemSchema)
    body: UpdateChecklistItemDto
  ): Promise<ChecklistItemResponse> {
    return this.checklistService.update(userId, tripId, itemId, body);
  }

  /**
   * Delete a checklist item
   *  DELETE /trips/:tripId/checklist/:itemId
   */
  @Delete(":itemId")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("itemId", ParseUUIDPipe) itemId: string
  ): Promise<null> {
    await this.checklistService.remove(userId, tripId, itemId);
    return null;
  }
}
