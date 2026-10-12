import { Schema, model } from "mongoose";
import { LOAN_STATUSES } from "../config/constants";
import { applyJsonTransform } from "../utils/serialize";
import { calculateOutstanding } from "../utils/loanMath";

const loanSchema = new Schema(
  {
    borrower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profile: { type: Schema.Types.ObjectId, ref: "BorrowerProfile", required: true },
    amount: { type: Number, required: true },
    tenureDays: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    interest: { type: Number, required: true },
    totalRepayment: { type: Number, required: true },
    totalPaid: { type: Number, default: 0 },
    status: { type: String, enum: LOAN_STATUSES, default: "APPLIED", index: true },
    rejectionReason: { type: String, default: null },
    sanctionedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sanctionedAt: { type: Date, default: null },
    disbursedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    disbursedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

loanSchema.virtual("outstanding").get(function () {
  return calculateOutstanding(this);
});

applyJsonTransform(loanSchema);

export const Loan = model("Loan", loanSchema);
