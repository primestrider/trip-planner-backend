import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import { TripAccessService } from "../trip-access.service";
import { MembersRepository } from "../members/members.repository";
import { toAmount } from "../money";
import {
  ExpenseShareInput,
  ExpensesRepository,
  ExpenseWithPayer
} from "./expenses.repository";
import { fromCents, settleBalances, splitEqually, toCents } from "./split";
import {
  BudgetSummaryResponse,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseUser,
  SettlementResponse
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
      splits: expense.shares.map((share) => ({
        user: toExpenseUser(share.user),
        amount: toAmount(share.amount)
      })),
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt
    };
  }

  /**
   * @throws BadRequestException if any user is not on the trip
   */
  private ensureParticipants(
    participants: string[],
    userIds: string[],
    message: string
  ): void {
    if (userIds.some((id) => !participants.includes(id))) {
      throw new BadRequestException(message);
    }
  }

  private toShares(
    amount: Prisma.Decimal | number,
    userIds: string[]
  ): ExpenseShareInput[] {
    return splitEqually(toCents(amount), userIds).map(({ userId, cents }) => ({
      userId,
      amount: fromCents(cents)
    }));
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

    const participants = await this.membersRepository.findParticipantIds(trip);

    // default payer is the user recording the expense
    const paidByUserId =
      payload.paidByUserId === undefined ? userId : payload.paidByUserId;

    if (paidByUserId !== null) {
      this.ensureParticipants(
        participants,
        [paidByUserId],
        "Payer must be a member of the trip"
      );
    }

    // default split is everyone currently on the trip
    const splitAmong = payload.splitAmong ?? participants;
    this.ensureParticipants(
      participants,
      splitAmong,
      "Expense can only be split among trip members"
    );

    const expense = await this.expensesRepository.create(
      {
        tripId: trip.id,
        category: payload.category,
        title: payload.title,
        amount: payload.amount,
        spentDate: payload.spentDate ? toDate(payload.spentDate) : null,
        paidByUserId,
        notes: payload.notes ?? null
      },
      this.toShares(payload.amount, splitAmong)
    );

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

    const needsParticipants =
      Boolean(payload.paidByUserId) ||
      payload.splitAmong !== undefined ||
      (payload.amount !== undefined && expense.shares.length === 0);
    const participants = needsParticipants
      ? await this.membersRepository.findParticipantIds(trip)
      : [];

    if (payload.paidByUserId) {
      this.ensureParticipants(
        participants,
        [payload.paidByUserId],
        "Payer must be a member of the trip"
      );
    }

    if (payload.splitAmong) {
      this.ensureParticipants(
        participants,
        payload.splitAmong,
        "Expense can only be split among trip members"
      );
    }

    // re-split when amount or members change; keep the same members
    // when only the amount changes
    let shares: ExpenseShareInput[] | undefined;
    if (payload.amount !== undefined || payload.splitAmong !== undefined) {
      const members =
        payload.splitAmong ??
        (expense.shares.length > 0
          ? expense.shares.map((share) => share.userId)
          : participants);
      shares = this.toShares(payload.amount ?? expense.amount, members);
    }

    const updated = await this.expensesRepository.update(
      expense.id,
      {
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
      },
      shares
    );

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

  /**
   * Who owes whom: each member's paid total vs their share of expenses,
   * and the fewest transfers that settle it.
   *
   * Expenses recorded before splits existed have no shares; they are
   * split equally among everyone currently on the trip.
   */
  async getSettlement(
    userId: string,
    tripId: string
  ): Promise<SettlementResponse> {
    const { trip } = await this.tripAccess.getTrip(userId, tripId);
    const [expenses, participants] = await Promise.all([
      this.expensesRepository.findForSettlement(trip.id),
      this.membersRepository.findParticipantIds(trip)
    ]);

    const paid = new Map<string, number>();
    const owed = new Map<string, number>();
    const add = (map: Map<string, number>, id: string, cents: number) =>
      map.set(id, (map.get(id) ?? 0) + cents);
    let unassignedCents = 0;

    for (const expense of expenses) {
      const amountCents = toCents(expense.amount);

      if (expense.paidByUserId === null) {
        unassignedCents += amountCents;
        continue;
      }

      add(paid, expense.paidByUserId, amountCents);

      const shares =
        expense.shares.length > 0
          ? expense.shares.map((share) => ({
              userId: share.userId,
              cents: toCents(share.amount)
            }))
          : splitEqually(amountCents, participants);

      for (const share of shares) {
        add(owed, share.userId, share.cents);
      }
    }

    // everyone on the trip, plus former members who still paid or owe
    const userIds = [
      ...new Set([...participants, ...paid.keys(), ...owed.keys()])
    ];
    const users = new Map(
      (await this.expensesRepository.findUsers(userIds)).map((user) => [
        user.id,
        toExpenseUser(user)
      ])
    );
    const userOf = (id: string): ExpenseUser =>
      users.get(id) ?? { userId: id, username: "deleted-user", name: null };

    const net = new Map(
      userIds.map((id) => [id, (paid.get(id) ?? 0) - (owed.get(id) ?? 0)])
    );

    return {
      currency: trip.currency,
      balances: userIds
        .map((id) => ({
          user: userOf(id),
          paid: fromCents(paid.get(id) ?? 0),
          share: fromCents(owed.get(id) ?? 0),
          net: fromCents(net.get(id) ?? 0)
        }))
        .sort((x, y) => y.net - x.net),
      transfers: settleBalances(net).map(({ from, to, cents }) => ({
        from: userOf(from),
        to: userOf(to),
        amount: fromCents(cents)
      })),
      unassignedTotal: fromCents(unassignedCents)
    };
  }
}
