import { z } from "zod";
import { LocationSchema } from "../location";

const dateRangeMessage = {
  path: ["checkOutDate"],
  message: "Check-out date must be after check-in date"
};

const AccommodationFields = z.object({
  name: z.string().trim().min(1).max(150),

  location: LocationSchema.nullable().optional(),

  // Date only, format YYYY-MM-DD
  checkInDate: z.iso.date(),

  checkOutDate: z.iso.date(),

  bookingCode: z.string().trim().max(100).nullable().optional(),

  notes: z.string().trim().max(5000).nullable().optional()
});

export const CreateAccommodationSchema = AccommodationFields.strict().refine(
  (data) => data.checkOutDate > data.checkInDate,
  dateRangeMessage
);

export const UpdateAccommodationSchema = AccommodationFields.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  })
  .refine(
    (data) =>
      !data.checkInDate ||
      !data.checkOutDate ||
      data.checkOutDate > data.checkInDate,
    dateRangeMessage
  );

export type CreateAccommodationDto = z.infer<typeof CreateAccommodationSchema>;
export type UpdateAccommodationDto = z.infer<typeof UpdateAccommodationSchema>;
