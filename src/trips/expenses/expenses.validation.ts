import { z } from "zod";
import { AmountSchema } from "../money";

export const EXPENSE_CATEGORIES = [
  "ACCOMMODATION",
  "TRANSPORT",
  "FOOD",
  "ACTIVITY",
  "SHOPPING",
  "OTHER"
] as const;

const ExpenseFields = z.object({
  category: z.enum(EXPENSE_CATEGORIES),

  title: z.string().trim().min(1).max(150),

  // in trip currency, must be more than 0
  amount: AmountSchema.refine((value) => value > 0, "Amount must be positive"),

  // Date only, format YYYY-MM-DD
  spentDate: z.iso.date().nullable().optional(),

  // trip member who paid; defaults to the user recording the expense
  paidByUserId: z.uuid().nullable().optional(),

  notes: z.string().trim().max(5000).nullable().optional()
});

export const CreateExpenseSchema = ExpenseFields.strict();

export const UpdateExpenseSchema = ExpenseFields.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

export const ListExpensesQuerySchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof UpdateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;
