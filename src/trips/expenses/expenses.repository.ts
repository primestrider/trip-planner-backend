import { Injectable } from "@nestjs/common";
import { ExpenseCategory, Prisma } from "@prisma/client";
import { PrismaService } from "src/common/prisma.service";

const paidBySelect = {
  paidBy: { select: { id: true, username: true, name: true } }
} satisfies Prisma.TripExpenseInclude;

export type ExpenseWithPayer = Prisma.TripExpenseGetPayload<{
  include: typeof paidBySelect;
}>;

/**
 * ExpensesRepository
 *
 * Repository responsible for interacting with the `trip_expenses` table.
 * Queries are scoped by `tripId`; access is checked by the caller.
 */
@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.TripExpenseUncheckedCreateInput
  ): Promise<ExpenseWithPayer> {
    return this.prisma.tripExpense.create({ data, include: paidBySelect });
  }

  async findByIdAndTrip(
    expenseId: string,
    tripId: string
  ): Promise<ExpenseWithPayer | null> {
    return this.prisma.tripExpense.findFirst({
      where: { id: expenseId, tripId },
      include: paidBySelect
    });
  }

  /**
   * List expenses of a trip, most recent first
   * (expenses without date last).
   */
  async findManyByTrip(
    tripId: string,
    category: ExpenseCategory | undefined,
    skip: number,
    take: number
  ): Promise<{ items: ExpenseWithPayer[]; total: number }> {
    const where: Prisma.TripExpenseWhereInput = {
      tripId,
      ...(category && { category })
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tripExpense.findMany({
        where,
        include: paidBySelect,
        orderBy: [
          { spentDate: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" }
        ],
        skip,
        take
      }),
      this.prisma.tripExpense.count({ where })
    ]);

    return { items, total };
  }

  /**
   * Totals per category and per payer for the budget summary
   */
  async summarize(tripId: string) {
    const [byCategory, byPayer] = await this.prisma.$transaction([
      this.prisma.tripExpense.groupBy({
        by: ["category"],
        where: { tripId },
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { category: "asc" }
      }),
      this.prisma.tripExpense.groupBy({
        by: ["paidByUserId"],
        where: { tripId },
        _sum: { amount: true },
        orderBy: { paidByUserId: "asc" }
      })
    ]);

    return { byCategory, byPayer };
  }

  async findUsers(userIds: string[]) {
    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, name: true }
    });
  }

  async update(
    expenseId: string,
    data: Prisma.TripExpenseUncheckedUpdateInput
  ): Promise<ExpenseWithPayer> {
    return this.prisma.tripExpense.update({
      where: { id: expenseId },
      data,
      include: paidBySelect
    });
  }

  async delete(expenseId: string): Promise<void> {
    await this.prisma.tripExpense.delete({
      where: { id: expenseId }
    });
  }
}
