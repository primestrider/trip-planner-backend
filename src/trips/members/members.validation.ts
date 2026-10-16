import { z } from "zod";

const MemberRole = z.enum(["EDITOR", "VIEWER"]);

export const AddMemberSchema = z
  .object({
    username: z.string().trim().min(1).max(100),

    role: MemberRole
  })
  .strict();

export const UpdateMemberSchema = z
  .object({
    role: MemberRole
  })
  .strict();

export type AddMemberDto = z.infer<typeof AddMemberSchema>;
export type UpdateMemberDto = z.infer<typeof UpdateMemberSchema>;
