import { Schema, model } from "mongoose";
import { EMPLOYMENT_MODES } from "../config/constants";
import { applyJsonTransform } from "../utils/serialize";

const salarySlipSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "SalarySlipFile", required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const borrowerProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    pan: { type: String, required: true, uppercase: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    monthlySalary: { type: Number, required: true },
    employmentMode: { type: String, enum: EMPLOYMENT_MODES, required: true },
    salarySlip: { type: salarySlipSchema, default: null },
  },
  { timestamps: true }
);

applyJsonTransform(borrowerProfileSchema);

export const BorrowerProfile = model("BorrowerProfile", borrowerProfileSchema);
