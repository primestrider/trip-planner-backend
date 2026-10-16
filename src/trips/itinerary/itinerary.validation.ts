import { z } from "zod";
import { LocationSchema } from "../location";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm format");

const timeRangeMessage = {
  path: ["endTime"],
  message: "End time must be on or after start time"
};

const ItineraryItemFields = z.object({
  dayNumber: z.number().int().min(1),

  title: z.string().trim().min(1).max(150),

  description: z.string().trim().max(5000).nullable().optional(),

  location: LocationSchema.nullable().optional(),

  startTime: time.nullable().optional(),

  endTime: time.nullable().optional()
});

export const CreateItineraryItemSchema = ItineraryItemFields.strict().refine(
  (data) => !data.startTime || !data.endTime || data.endTime >= data.startTime,
  timeRangeMessage
);

export const UpdateItineraryItemSchema = ItineraryItemFields.partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  })
  .refine(
    (data) =>
      !data.startTime || !data.endTime || data.endTime >= data.startTime,
    timeRangeMessage
  );

export type CreateItineraryItemDto = z.infer<typeof CreateItineraryItemSchema>;
export type UpdateItineraryItemDto = z.infer<typeof UpdateItineraryItemSchema>;
