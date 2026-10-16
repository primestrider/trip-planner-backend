import { z } from "zod";

export const CreateInviteSchema = z
  .object({
    role: z.enum(["EDITOR", "VIEWER"]),

    expiresInDays: z.number().int().min(1).max(30).default(7),

    // omit for unlimited uses
    maxUses: z.number().int().min(1).max(1000).nullable().optional()
  })
  .strict();

export type CreateInviteDto = z.infer<typeof CreateInviteSchema>;
