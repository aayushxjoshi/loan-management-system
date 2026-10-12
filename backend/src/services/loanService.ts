import path from "path";
import { Loan } from "../models/Loan";
import { BorrowerProfile } from "../models/BorrowerProfile";
import { LoanStatus, OPEN_LOAN_STATUSES } from "../config/constants";
import { calculateRepayment } from "../utils/loanMath";
import { AppError } from "../utils/AppError";
import { LoanStateMachine } from "./loanStateMachine";
import { UPLOAD_DIR } from "../middleware/upload";

const LOAN_LIST_POPULATE = [
  { path: "borrower", select: "name email" },
  { path: "profile", select: "fullName pan monthlySalary" },
];

export class LoanService {
  constructor(
    private readonly loanModel: typeof Loan,
    private readonly profileModel: typeof BorrowerProfile,
    private readonly stateMachine: LoanStateMachine
  ) {}

  async applyForLoan(borrowerId: string, input: { amount: number; tenureDays: number }) {
    const profile = await this.profileModel.findOne({ user: borrowerId });
    if (!profile) throw AppError.badRequest("Complete your profile before applying");
    if (!profile.salarySlip) throw AppError.badRequest("Upload your salary slip before applying");

    const hasOpenLoan = await this.loanModel.exists({ borrower: borrowerId, status: { $in: OPEN_LOAN_STATUSES } });
    if (hasOpenLoan) throw AppError.conflict("You already have an open loan");

    return this.loanModel.create({
      borrower: borrowerId,
      profile: profile.id,
      amount: input.amount,
      tenureDays: input.tenureDays,
      ...calculateRepayment(input.amount, input.tenureDays),
    });
  }

  listBorrowerLoans(borrowerId: string) {
    return this.loanModel.find({ borrower: borrowerId }).sort({ createdAt: -1 });
  }

  listLoansByStatus(status: LoanStatus) {
    return this.loanModel.find({ status }).sort({ createdAt: -1 }).populate(LOAN_LIST_POPULATE);
  }

  async findLoanOrThrow(loanId: string) {
    const loan = await this.loanModel.findById(loanId);
    if (!loan) throw AppError.notFound("Loan not found");
    return loan;
  }

  async approveLoan(loanId: string, staffId: string) {
    const loan = await this.findLoanOrThrow(loanId);
    this.stateMachine.transition(loan, "SANCTIONED");
    loan.sanctionedBy = staffId as never;
    loan.sanctionedAt = new Date();
    return loan.save();
  }

  async rejectLoan(loanId: string, staffId: string, reason: string) {
    const loan = await this.findLoanOrThrow(loanId);
    this.stateMachine.transition(loan, "REJECTED");
    loan.rejectionReason = reason;
    loan.sanctionedBy = staffId as never;
    loan.sanctionedAt = new Date();
    return loan.save();
  }

  async disburseLoan(loanId: string, staffId: string) {
    const loan = await this.findLoanOrThrow(loanId);
    this.stateMachine.transition(loan, "DISBURSED");
    loan.disbursedBy = staffId as never;
    loan.disbursedAt = new Date();
    return loan.save();
  }

  async getSalarySlipFile(loanId: string) {
    const loan = await this.findLoanOrThrow(loanId);
    const profile = await this.profileModel.findById(loan.profile);
    if (!profile?.salarySlip) throw AppError.notFound("Salary slip not found");
    const { path: storedName, originalName, mimeType } = profile.salarySlip;
    return { filePath: path.join(UPLOAD_DIR, path.basename(storedName)), originalName, mimeType };
  }
}
