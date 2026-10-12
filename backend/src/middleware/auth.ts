import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "../config/constants";
import { AppError } from "../utils/AppError";

export interface AuthUser {
  id: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthUser;
  }
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, { expiresIn: "1d" });
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(AppError.unauthorized());

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.auth = { id: String(payload.sub), role: payload.role as Role };
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
}

// Admin always passes.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (req.auth.role === "admin" || roles.includes(req.auth.role)) return next();
    next(AppError.forbidden());
  };
}
