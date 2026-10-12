export const ROLES = ["admin", "sales", "sanction", "disbursement", "collection", "borrower"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_MODES = ["SALARIED", "SELF_EMPLOYED", "UNEMPLOYED"] as const;
export type EmploymentMode = (typeof EMPLOYMENT_MODES)[number];

export const LOAN_STATUSES = ["APPLIED", "SANCTIONED", "REJECTED", "DISBURSED", "CLOSED"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const OPEN_LOAN_STATUSES: LoanStatus[] = ["APPLIED", "SANCTIONED", "DISBURSED"];

export const INTEREST_RATE = 12;

export const LOAN_LIMITS = {
  minAmount: 50000,
  maxAmount: 500000,
  minTenureDays: 30,
  maxTenureDays: 365,
};

export const SALARY_SLIP_MAX_BYTES = 5 * 1024 * 1024;
export const SALARY_SLIP_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
