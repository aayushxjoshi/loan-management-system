import { LoanStatus } from "../config/constants";
import { AppError } from "../utils/AppError";

export class LoanStateMachine {
  readonly ALLOWED_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
    APPLIED: ["SANCTIONED", "REJECTED"],
    SANCTIONED: ["DISBURSED"],
    DISBURSED: ["CLOSED"],
    REJECTED: [],
    CLOSED: [],
  };

  canTransition(from: LoanStatus, to: LoanStatus): boolean {
    return this.ALLOWED_TRANSITIONS[from].includes(to);
  }

  // The single place where a loan's status changes.
  transition<T extends { status: LoanStatus }>(loan: T, to: LoanStatus): T {
    if (!this.canTransition(loan.status, to)) {
      throw AppError.conflict(`Cannot move loan from ${loan.status} to ${to}`);
    }
    loan.status = to;
    return loan;
  }
}
