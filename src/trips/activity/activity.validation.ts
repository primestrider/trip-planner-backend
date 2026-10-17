import { z } from "zod";

export const ListActivityQuerySchema = z.object({
  // nextCursor from the previous page; omit for the newest items
  cursor: z.string().min(1).max(200).optional(),

  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type ListActivityQuery = z.infer<typeof ListActivityQuerySchema>;
