import { z } from "zod";

export const RegisterSchema = z
  .object({
    username: z.string().min(1).max(100),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine((value) => /\d/.test(value), {
        message: "Password must contain at least one number"
      })
      .refine((value) => /[^a-zA-Z0-9]/.test(value), {
        message: "Password must contain at least one symbol"
      }),

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

export type RegisterUserDto = z.infer<typeof RegisterSchema>;
export type LoginUserDto = z.infer<typeof LoginSchema>;
