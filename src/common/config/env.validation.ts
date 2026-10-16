import { z } from "zod";
import { parseDuration } from "src/utils/parser";

const duration = z.string().refine((value) => {
  try {
    return parseDuration(value) > 0;
  } catch {
    return false;
  }
}, 'Must be a duration such as "15m", "1h" or "30d"');

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    DATABASE_HOST: z.string().min(1),
    DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().default(""),
    DATABASE_NAME: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32, "Use at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "Use at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: duration,
    JWT_REFRESH_EXPIRES_IN: duration,

    // comma-separated browser origins allowed to call the API,
    // e.g. "http://localhost:5173,https://app.example.com"; empty = CORS off
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      )
      .pipe(z.array(z.url({ protocol: /^https?$/ })))
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ["JWT_REFRESH_SECRET"],
    message: "Must differ from JWT_ACCESS_SECRET"
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validate environment variables at startup, so a missing or weak setting
 * stops the app immediately with a clear message instead of failing
 * on the first request.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return result.data;
}
