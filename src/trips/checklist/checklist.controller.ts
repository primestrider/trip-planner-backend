import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ChecklistService } from "./checklist.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import { ValidationPipe } from "src/common/validation/validation.pipe";
import {
  type CreateChecklistItemDto,
  type ListChecklistQuery,
  type UpdateChecklistItemDto,
  CreateChecklistItemSchema,
  ListChecklistQuerySchema,
  UpdateChecklistItemSchema
} from "./checklist.validation";
import { type ChecklistItemResponse, type ChecklistResponse } from "./models";

@Controller("trips/:tripId/checklist")
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
    @Query(ValidationPipe(ListChecklistQuerySchema)) query: ListChecklistQuery
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
    @Body(ValidationPipe(CreateChecklistItemSchema))
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
    @Body(ValidationPipe(UpdateChecklistItemSchema))
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
