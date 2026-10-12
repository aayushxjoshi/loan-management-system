import { Schema, model, InferSchemaType } from "mongoose";
import { ROLES } from "../config/constants";
import { applyJsonTransform } from "../utils/serialize";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "borrower", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

applyJsonTransform(userSchema, ["passwordHash"]);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
