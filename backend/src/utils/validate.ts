import { ZodTypeAny, z } from "zod";
import mongoose from "mongoose";
import { AppError } from "./AppError";

export function parseOrThrow<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const errors = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
  throw AppError.badRequest("Invalid input", errors);
}

export function assertObjectId(id: string): void {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound();
}
