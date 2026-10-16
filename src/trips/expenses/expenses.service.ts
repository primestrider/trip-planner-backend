import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, Trip } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { MembersRepository } from "../members/members.repository";
import { toAmount } from "../money";
import { ExpensesRepository, ExpenseWithPayer } from "./expenses.repository";
import {
  BudgetSummaryResponse,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseUser
} from "./models";
import {
  CreateExpenseDto,
  ListExpensesQuery,
  UpdateExpenseDto
} from "./expenses.validation";
import { toDate, toDateString } from "src/utils/date";

function toExpenseUser(user: {
  id: string;
  username: string;
  name: string | null;
}): ExpenseUser {
  return { userId: user.id, username: user.username, name: user.name };
}

/**
 * ExpensesService records what is spent on a trip and
 * compares it with the trip budget.
 * Any member can read; EDITOR or OWNER can change.
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly tripAccess: TripAccessService,
    private readonly expensesRepository: ExpensesRepository,
    private readonly membersRepository: MembersRepository,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger
  ) {}

  private toResponse(expense: ExpenseWithPayer): ExpenseResponse {
    return {
      id: expense.id,
      category: expense.category,
      title: expense.title,
      amount: toAmount(expense.amount),
      spentDate: expense.spentDate ? toDateString(expense.spentDate) : null,
      paidBy: expense.paidBy ? toExpenseUser(expense.paidBy) : null,
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt
    };
  }

  /**
   * Payer must be the owner or a member of the trip.
   *
   * @throws BadRequestException
   */
  private async ensureParticipant(trip: Trip, userId: string): Promise<void> {
    if (userId === trip.userId) {
      return;
    }

    const member = await this.membersRepository.findByTripAndUser(
      trip.id,
      userId
    );

    if (!member) {
      throw new BadRequestException("Payer must be a member of the trip");
    }
  }

  /**
   * @throws NotFoundException if expense does not belong to the trip
   */
  private async findExpense(
    tripId: string,
    expenseId: string
  ): Promise<ExpenseWithPayer> {
    const expense = await this.expensesRepository.findByIdAndTrip(
      expenseId,
      tripId
    );

    if (!expense) {
      throw new NotFoundException("Expense not found");
    }

    return expense;
  }

  async list(
    userId: string,
    tripId: string,
    query: ListExpensesQuery
  ): Promise<ExpenseListResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const { page, limit, category } = query;

    const { items, total } = await this.expensesRepository.findManyByTrip(
      trip.id,
      category,
      (page - 1) * limit,
      limit
    );

    return {
      items: items.map((expense) => this.toResponse(expense)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async create(
    userId: string,
    tripId: string,
    payload: CreateExpenseDto
  ): Promise<ExpenseResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");

    // default payer is the user recording the expense
    const paidByUserId =
      payload.paidByUserId === undefined ? userId : payload.paidByUserId;

    if (paidByUserId !== null) {
      await this.ensureParticipant(trip, paidByUserId);
    }

    const expense = await this.expensesRepository.create({
      tripId: trip.id,
      category: payload.category,
      title: payload.title,
      amount: payload.amount,
      spentDate: payload.spentDate ? toDate(payload.spentDate) : null,
      paidByUserId,
      notes: payload.notes ?? null
    });

    this.logger.info("Expense created", {
      userId,
      tripId,
      expenseId: expense.id
    });

    return this.toResponse(expense);
  }

  async update(
    userId: string,
    tripId: string,
    expenseId: string,
    payload: UpdateExpenseDto
  ): Promise<ExpenseResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const expense = await this.findExpense(trip.id, expenseId);

    if (payload.paidByUserId) {
      await this.ensureParticipant(trip, payload.paidByUserId);
    }

    const updated = await this.expensesRepository.update(expense.id, {
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.amount !== undefined && { amount: payload.amount }),
      ...(payload.spentDate !== undefined && {
        spentDate: payload.spentDate ? toDate(payload.spentDate) : null
      }),
      ...(payload.paidByUserId !== undefined && {
        paidByUserId: payload.paidByUserId
      }),
      ...(payload.notes !== undefined && { notes: payload.notes })
    });

    this.logger.info("Expense updated", { userId, tripId, expenseId });

    return this.toResponse(updated);
  }

  async remove(
    userId: string,
    tripId: string,
    expenseId: string
  ): Promise<void> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId, "EDITOR");
    const expense = await this.findExpense(trip.id, expenseId);

    await this.expensesRepository.delete(expense.id);

    this.logger.info("Expense deleted", { userId, tripId, expenseId });
  }

  /**
   * Budget vs spending, per category and per payer.
   * Sums are done in DECIMAL to avoid floating point drift.
   */
  async getBudgetSummary(
    userId: string,
    tripId: string
  ): Promise<BudgetSummaryResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const { byCategory, byPayer } = await this.expensesRepository.summarize(
      trip.id
    );

    const zero = new Prisma.Decimal(0);
    const totalSpent = byCategory.reduce(
      (sum, row) => sum.plus(row._sum?.amount ?? zero),
      zero
    );

    const payerIds = byPayer
      .map((row) => row.paidByUserId)
      .filter((id): id is string => id !== null);
    const payers = new Map(
      (await this.expensesRepository.findUsers(payerIds)).map((user) => [
        user.id,
        toExpenseUser(user)
      ])
    );

    return {
      currency: trip.currency,
      budgetAmount: toAmount(trip.budgetAmount),
      totalSpent: totalSpent.toNumber(),
      remaining: trip.budgetAmount
        ? trip.budgetAmount.minus(totalSpent).toNumber()
        : null,
      byCategory: byCategory.map((row) => ({
        category: row.category,
        total: (row._sum?.amount ?? zero).toNumber(),
        count: typeof row._count === "object" ? (row._count._all ?? 0) : 0
      })),
      byPayer: byPayer
        .map((row) => ({
          paidBy: row.paidByUserId
            ? (payers.get(row.paidByUserId) ?? null)
            : null,
          total: (row._sum?.amount ?? zero).toNumber()
        }))
        .sort((a, b) => b.total - a.total)
    };
  }
}
