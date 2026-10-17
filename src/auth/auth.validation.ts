import { z } from "zod";

/**
 * Password rules shared by register and change password
 */
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((value) => /\d/.test(value), {
    message: "Password must contain at least one number"
  })
  .refine((value) => /[^a-zA-Z0-9]/.test(value), {
    message: "Password must contain at least one symbol"
  });

export const RegisterSchema = z
  .object({
    username: z.string().min(1).max(100),

    password: PasswordSchema,

    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const LoginSchema = z.object({
  username: z.string().min(1),

  password: z.string().min(1)
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),

    newPassword: PasswordSchema,

    confirmPassword: z.string()
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "New password must differ from the current password"
  });

export type RegisterUserDto = z.infer<typeof RegisterSchema>;
export type LoginUserDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
