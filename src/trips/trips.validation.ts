import { z } from "zod";
import { AmountSchema, CurrencySchema } from "./money";

const dateRangeMessage = {
  path: ["endDate"],
  message: "End date must be on or after start date"
};

const TripFields = z.object({
  title: z.string().trim().min(1).max(150),

  destination: z.string().trim().min(1).max(150),

  description: z.string().trim().max(5000).nullable().optional(),

  // Date only, format YYYY-MM-DD
  startDate: z.iso.date(),

  endDate: z.iso.date(),

  // defaults to IDR
  currency: CurrencySchema.optional(),

  // planned total budget in trip currency
  budgetAmount: AmountSchema.nullable().optional()
});

export const CreateTripSchema = TripFields.strict().refine(
  (data) => data.endDate >= data.startDate,
  dateRangeMessage
);

export const UpdateTripSchema = TripFields.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  })
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.endDate >= data.startDate,
    dateRangeMessage
  );

export const ListTripsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateTripDto = z.infer<typeof CreateTripSchema>;
export type UpdateTripDto = z.infer<typeof UpdateTripSchema>;
export type ListTripsQuery = z.infer<typeof ListTripsQuerySchema>;
