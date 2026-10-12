import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound("Route not found"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 5MB)" : err.message;
    return res.status(400).json({ message });
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
