// Mirrors backend utils/loanMath.ts. Simple interest, rate is % per year.
export const INTEREST_RATE = 12;
export const MIN_AMOUNT = 50000;
export const MAX_AMOUNT = 500000;
export const AMOUNT_STEP = 5000;
export const MIN_TENURE_DAYS = 30;
export const MAX_TENURE_DAYS = 365;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRepayment(amount: number, tenureDays: number) {
  const interest = roundMoney((amount * INTEREST_RATE * tenureDays) / (365 * 100));
  const totalRepayment = roundMoney(amount + interest);
  return { principal: amount, rate: INTEREST_RATE, interest, totalRepayment };
}
