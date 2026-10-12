import { INTEREST_RATE } from "../config/constants";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface Repayment {
  interestRate: number;
  interest: number;
  totalRepayment: number;
}

// Simple interest: amount * rate% per year * (tenureDays / 365).
export function calculateRepayment(amount: number, tenureDays: number): Repayment {
  const interest = roundMoney((amount * INTEREST_RATE * tenureDays) / (100 * 365));
  return {
    interestRate: INTEREST_RATE,
    interest,
    totalRepayment: roundMoney(amount + interest),
  };
}

export function calculateOutstanding(loan: { totalRepayment: number; totalPaid: number }): number {
  return roundMoney(loan.totalRepayment - loan.totalPaid);
}
