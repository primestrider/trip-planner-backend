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
import { ExpensesService } from "./expenses.service";
import { AccessTokenGuard } from "src/auth/guards/access-token.guard";
import { CurrentUser } from "src/common/decorator/current-user.decorator";
import {
  type CreateExpenseDto,
  type ListExpensesQuery,
  type UpdateExpenseDto,
  CreateExpenseSchema,
  ListExpensesQuerySchema,
  UpdateExpenseSchema
} from "./expenses.validation";
import {
  type BudgetSummaryResponse,
  type ExpenseListResponse,
  type ExpenseResponse,
  type SettlementResponse
} from "./models";

@ApiTags("expenses")
@Controller("trips/:tripId")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * Budget vs spending summary
   *  GET /trips/:tripId/budget
   */
  @Get("budget")
  async getBudgetSummary(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<BudgetSummaryResponse> {
    return this.expensesService.getBudgetSummary(userId, tripId);
  }

  /**
   * Who owes whom, with the fewest transfers to settle up
   *  GET /trips/:tripId/settlement
   */
  @Get("settlement")
  async getSettlement(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string
  ): Promise<SettlementResponse> {
    return this.expensesService.getSettlement(userId, tripId);
  }

  /**
   * List expenses of a trip
   *  GET /trips/:tripId/expenses?category=FOOD&page=1&limit=50
   */
  @Get("expenses")
  async list(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodQuery(ListExpensesQuerySchema) query: ListExpensesQuery
  ): Promise<ExpenseListResponse> {
    return this.expensesService.list(userId, tripId, query);
  }

  /**
   * Record an expense
   *  POST /trips/:tripId/expenses
   */
  @Post("expenses")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @ZodBody(CreateExpenseSchema) body: CreateExpenseDto
  ): Promise<ExpenseResponse> {
    return this.expensesService.create(userId, tripId, body);
  }

  /**
   * Update an expense
   *  PATCH /trips/:tripId/expenses/:expenseId
   */
  @Patch("expenses/:expenseId")
  async update(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string,
    @ZodBody(UpdateExpenseSchema) body: UpdateExpenseDto
  ): Promise<ExpenseResponse> {
    return this.expensesService.update(userId, tripId, expenseId, body);
  }

  /**
   * Delete an expense
   *  DELETE /trips/:tripId/expenses/:expenseId
   */
  @Delete("expenses/:expenseId")
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser("sub") userId: string,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("expenseId", ParseUUIDPipe) expenseId: string
  ): Promise<null> {
    await this.expensesService.remove(userId, tripId, expenseId);
    return null;
  }
}
