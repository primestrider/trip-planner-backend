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
import { ZodBody } from "src/common/validation/zod.decorators";
import { TransportsService } from "./transports.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type CreateTransportDto,
  type UpdateTransportDto,
  CreateTransportSchema,
  UpdateTransportSchema
} from "./transports.validation";
import { type TransportResponse } from "./models";

@ApiTags("transports")
@Controller("trips/:tripId/transports")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class TransportsController {
  constructor(private readonly transportsService: TransportsService) {}

  /**
   * List transports of a trip
   *  GET /trips/:tripId/transports
   */
  @Get()
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<TransportResponse[]> {
    return this.transportsService.list(userId, tripId);
  }

  /**
   * Get transport detail
   *  GET /trips/:tripId/transports/:id
   */
  @Get(":id")
  async findOne(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) transportId: string
  ): Promise<TransportResponse> {
    return this.transportsService.findOne(userId, tripId, transportId);
  }

  /**
   * Add a transport
   *  POST /trips/:tripId/transports
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodBody(CreateTransportSchema)
    body: CreateTransportDto
  ): Promise<TransportResponse> {
    return this.transportsService.create(userId, tripId, body);
  }

  /**
   * Update a transport
   *  PATCH /trips/:tripId/transports/:id
   */
  @Patch(":id")
  async update(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) transportId: string,
    @ZodBody(UpdateTransportSchema)
    body: UpdateTransportDto
  ): Promise<TransportResponse> {
    return this.transportsService.update(userId, tripId, transportId, body);
  }

  /**
   * Delete a transport
   *  DELETE /trips/:tripId/transports/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) transportId: string
  ): Promise<null> {
    await this.transportsService.remove(userId, tripId, transportId);
    return null;
  }
}
