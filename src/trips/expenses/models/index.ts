import { ExpenseCategory } from "@prisma/client";

export type ExpenseUser = {
  userId: string;
  username: string;
  name: string | null;
};

/**
 * Expense of a trip. `amount` is in trip currency,
 * `spentDate` is formatted as YYYY-MM-DD.
 */
export type ExpenseResponse = {
  id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  spentDate: string | null;
  paidBy: ExpenseUser | null;
  // equal parts owed by each member; sums to amount
  splits: { user: ExpenseUser; amount: number }[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpenseListResponse = {
  items: ExpenseResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Budget compared with what has been spent, in trip currency
 */
export type BudgetSummaryResponse = {
  currency: string;
  budgetAmount: number | null;
  totalSpent: number;
  // budgetAmount - totalSpent; negative when over budget
  remaining: number | null;
  byCategory: {
    category: ExpenseCategory;
    total: number;
    count: number;
  }[];
  // `paidBy` is null for expenses without a known payer
  byPayer: {
    paidBy: ExpenseUser | null;
    total: number;
  }[];
};

/**
 * Who owes whom, in trip currency.
 * net = paid - share; positive means the member should receive money.
 */
export type SettlementResponse = {
  currency: string;
  balances: {
    user: ExpenseUser;
    paid: number;
    share: number;
    net: number;
  }[];
  // fewest transfers that settle every balance
  transfers: {
    from: ExpenseUser;
    to: ExpenseUser;
    amount: number;
  }[];
  // expenses without a known payer, not included in balances
  unassignedTotal: number;
};
