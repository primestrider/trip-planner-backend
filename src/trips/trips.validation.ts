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

  // https image URL shown as the trip cover
  coverImageUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional(),

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

  limit: z.coerce.number().int().min(1).max(100).default(20),

  // search in title and destination
  q: z.string().trim().min(1).max(100).optional(),

  // relative to `today`
  status: z.enum(["upcoming", "ongoing", "past"]).optional(),

  // owner: trips the user created; shared: trips the user collaborates on
  role: z.enum(["owner", "shared"]).optional(),

  // by start date
  order: z.enum(["asc", "desc"]).default("desc"),

  // client's local date (YYYY-MM-DD) for `status`; defaults to UTC today
  today: z.iso.date().optional()
});

export const DuplicateTripSchema = z
  .object({
    // defaults to "<original title> (copy)"
    title: z.string().trim().min(1).max(150).optional(),

    // new start date; the trip keeps its length
    startDate: z.iso.date().optional()
  })
  .strict();

export type CreateTripDto = z.infer<typeof CreateTripSchema>;
export type UpdateTripDto = z.infer<typeof UpdateTripSchema>;
export type ListTripsQuery = z.infer<typeof ListTripsQuerySchema>;
export type DuplicateTripDto = z.infer<typeof DuplicateTripSchema>;
