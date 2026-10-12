import { Schema, model } from "mongoose";
import { applyJsonTransform } from "../utils/serialize";

const paymentSchema = new Schema(
  {
    loan: { type: Schema.Types.ObjectId, ref: "Loan", required: true, index: true },
    utr: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paidOn: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

applyJsonTransform(paymentSchema);

export const Payment = model("Payment", paymentSchema);
