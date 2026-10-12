export type Role = "admin" | "sales" | "sanction" | "disbursement" | "collection" | "borrower";

export type EmploymentMode = "SALARIED" | "SELF_EMPLOYED" | "UNEMPLOYED";

export type LoanStatus = "APPLIED" | "SANCTIONED" | "REJECTED" | "DISBURSED" | "CLOSED";

export type LeadStage = "REGISTERED" | "PROFILE_COMPLETED" | "SLIP_UPLOADED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SalarySlip {
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface BorrowerProfile {
  fullName: string;
  pan: string;
  dateOfBirth: string;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  salarySlip: SalarySlip | null;
}

export interface ProfileInput {
  fullName: string;
  pan: string;
  dateOfBirth: string;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export interface Loan {
  id: string;
  amount: number;
  tenureDays: number;
  interestRate: number;
  interest: number;
  totalRepayment: number;
  totalPaid: number;
  outstanding: number;
  status: LoanStatus;
  rejectionReason?: string | null;
  createdAt: string;
  borrower?: { name: string; email: string };
  profile?: { fullName: string; pan: string; monthlySalary: number };
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  signedUpAt: string;
  stage: LeadStage;
}

export interface Payment {
  id: string;
  utr: string;
  amount: number;
  paidOn: string;
}

export interface PaymentInput {
  utr: string;
  amount: number;
  paidOn: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
