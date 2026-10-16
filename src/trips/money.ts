import { Prisma } from "@prisma/client";
import { z } from "zod";

// fits DECIMAL(14, 2)
const MAX_AMOUNT = 999_999_999_999.99;

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

/**
 * Money amount in trip currency, up to 2 decimal places
 */
export const AmountSchema = z
  .number()
  .min(0)
  .max(MAX_AMOUNT)
  .refine(hasAtMostTwoDecimals, "Amount must have at most 2 decimal places");

/**
 * ISO 4217 currency code, e.g. IDR, USD
 */
export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code");

/**
 * Convert a stored DECIMAL to number for JSON responses
 */
export function toAmount(value: Prisma.Decimal): number;
export function toAmount(value: Prisma.Decimal | null): number | null;
export function toAmount(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
