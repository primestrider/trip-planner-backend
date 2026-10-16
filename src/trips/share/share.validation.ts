import { z } from "zod";

export const EnableShareSchema = z
  .object({
    // true replaces the current link, so the old one stops working
    regenerate: z.boolean().default(false)
  })
  .strict();

export type EnableShareDto = z.infer<typeof EnableShareSchema>;
