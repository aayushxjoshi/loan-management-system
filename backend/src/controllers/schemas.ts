import { z } from "zod";
import { EMPLOYMENT_MODES, LOAN_LIMITS } from "../config/constants";

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Must be a valid date")
  .transform((value) => new Date(value));

export const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1),
  pan: z.string().trim().min(1),
  dateOfBirth: isoDate,
  monthlySalary: z.number().positive(),
  employmentMode: z.enum(EMPLOYMENT_MODES),
});

export const loanApplicationSchema = z.object({
  amount: z.number().min(LOAN_LIMITS.minAmount).max(LOAN_LIMITS.maxAmount),
  tenureDays: z.number().int().min(LOAN_LIMITS.minTenureDays).max(LOAN_LIMITS.maxTenureDays),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required"),
});

export const paymentSchema = z.object({
  utr: z.string().trim().min(1, "UTR is required"),
  amount: z.number().positive(),
  paidOn: isoDate,
});

export function statusQuerySchema<T extends [string, ...string[]]>(allowed: T) {
  return z.object({ status: z.enum(allowed).optional() });
}
