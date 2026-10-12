import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "test-only-secret",
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN || "http://localhost:3000"),
};

// CLIENT_ORIGIN can hold several comma-separated origins, e.g. "http://localhost:3000,http://127.0.0.1:3000".
function parseOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean);
}

export function assertRuntimeEnv(): void {
  if (!env.mongoUri) throw new Error("MONGODB_URI is required");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
}
