import { Schema, model } from "mongoose";
import { applyJsonTransform } from "../utils/serialize";

// Kept in its own collection so the bytes are never loaded with a profile or loan.
const salarySlipFileSchema = new Schema(
  {
    borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    data: { type: Buffer, required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

applyJsonTransform(salarySlipFileSchema);

export const SalarySlipFile = model("SalarySlipFile", salarySlipFileSchema);
