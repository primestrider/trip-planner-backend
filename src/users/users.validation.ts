import { z } from "zod";

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).nullable().optional(),

    avatarId: z.number().int().positive().nullable().optional()
  })
  .strict()
  .refine((data) => data.name !== undefined || data.avatarId !== undefined, {
    message: "At least one field must be provided"
  });

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export const DeleteAccountSchema = z
  .object({
    // current password, to confirm it is really the account owner
    password: z.string().min(1)
  })
  .strict();

export type DeleteAccountDto = z.infer<typeof DeleteAccountSchema>;
