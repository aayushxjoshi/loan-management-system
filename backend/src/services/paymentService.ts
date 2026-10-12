import { Loan } from "../models/Loan";
import { Payment } from "../models/Payment";
import { AppError } from "../utils/AppError";
import { calculateOutstanding, roundMoney } from "../utils/loanMath";
import { LoanService } from "./loanService";
import { LoanStateMachine } from "./loanStateMachine";

export interface PaymentInput {
  utr: string;
  amount: number;
  paidOn: Date;
}

// Pure checks, kept separate so they are easy to unit test.
export function validatePayment(
  loan: { outstanding: number },
  input: PaymentInput,
  now: Date = new Date()
): string[] {
  const errors: string[] = [];
  if (!(input.amount > 0)) errors.push("Amount must be greater than 0");
  else if (input.amount > loan.outstanding) errors.push(`Amount exceeds outstanding balance of ${loan.outstanding}`);
  if (!input.utr) errors.push("UTR is required");
  if (input.paidOn.getTime() > now.getTime()) errors.push("Payment date cannot be in the future");
  return errors;
}

export class PaymentService {
  constructor(
    private readonly loanModel: typeof Loan,
    private readonly paymentModel: typeof Payment,
    private readonly loanService: LoanService,
    private readonly stateMachine: LoanStateMachine
  ) {}

  async recordPayment(loanId: string, staffId: string, rawInput: PaymentInput) {
    const input = { ...rawInput, utr: rawInput.utr.trim().toUpperCase(), amount: roundMoney(rawInput.amount) };
    const loan = await this.loanService.findLoanOrThrow(loanId);

    if (loan.status !== "DISBURSED") throw AppError.conflict("Payments can only be recorded for disbursed loans");

    const errors = validatePayment({ outstanding: calculateOutstanding(loan) }, input);
    if (errors.length > 0) throw AppError.badRequest("Invalid payment", errors);

    if (await this.paymentModel.exists({ utr: input.utr })) throw AppError.conflict("UTR already used");

    let payment;
    try {
      payment = await this.paymentModel.create({ loan: loan.id, recordedBy: staffId, ...input });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw AppError.conflict("UTR already used");
      throw err;
    }

    const updatedLoan = await this.applyPaymentToLoan(loan.id, loan.totalPaid, input.amount);
    if (!updatedLoan) {
      // Someone else changed the loan between our read and write; undo and let the caller retry.
      await this.paymentModel.deleteOne({ _id: payment.id });
      throw AppError.conflict("Loan was updated by another request, please retry");
    }
    return { payment, loan: updatedLoan };
  }

  async listPayments(loanId: string) {
    await this.loanService.findLoanOrThrow(loanId);
    return this.paymentModel.find({ loan: loanId }).sort({ paidOn: -1, createdAt: -1 });
  }

  private async applyPaymentToLoan(loanId: string, previousTotalPaid: number, amount: number) {
    // Compare-and-set on totalPaid so two parallel payments cannot overpay.
    const loan = await this.loanModel.findOneAndUpdate(
      { _id: loanId, status: "DISBURSED", totalPaid: previousTotalPaid },
      { $set: { totalPaid: roundMoney(previousTotalPaid + amount) } },
      { returnDocument: "after" }
    );
    if (!loan) return null;

    if (calculateOutstanding(loan) === 0) {
      this.stateMachine.transition(loan, "CLOSED");
      loan.closedAt = new Date();
      await loan.save();
    }
    return loan;
  }
}
