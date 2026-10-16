import { z } from "zod";
import { LocationSchema } from "../location";
import { isLocalDateTime } from "src/utils/date";

// Local time at origin / destination, format YYYY-MM-DDTHH:mm.
// No arrival >= departure check: time zones can make a flight
// "arrive" earlier in local time than it departs.
const localDateTime = z
  .string()
  .refine(isLocalDateTime, "Must be a date-time in YYYY-MM-DDTHH:mm format");

const TransportFields = z.object({
  type: z.enum(["FLIGHT", "TRAIN", "BUS", "CAR", "FERRY", "OTHER"]),

  carrier: z.string().trim().max(100).nullable().optional(),

  // flight / train number
  number: z.string().trim().max(50).nullable().optional(),

  origin: LocationSchema,

  destination: LocationSchema,

  departureAt: localDateTime,

  arrivalAt: localDateTime.nullable().optional(),

  bookingCode: z.string().trim().max(100).nullable().optional(),

  notes: z.string().trim().max(5000).nullable().optional()
});

export const CreateTransportSchema = TransportFields.strict();

export const UpdateTransportSchema = TransportFields.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

export type CreateTransportDto = z.infer<typeof CreateTransportSchema>;
export type UpdateTransportDto = z.infer<typeof UpdateTransportSchema>;
