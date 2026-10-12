import type {
  AuthResponse,
  BorrowerProfile,
  Lead,
  Loan,
  LoanStatus,
  Payment,
  PaymentInput,
  ProfileInput,
  User,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const TOKEN_KEY = "lms_token";

export const tokenStore = {
  get: (): string | null => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  errors: string[];

  constructor(status: number, message: string, errors: string[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function send(path: string, method: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Please try again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.message ?? "Something went wrong", data.errors ?? []);
  }
  return res;
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await send(path, method, body);
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, "POST", body);

export const api = {
  // auth
  signup: (input: { name: string; email: string; password: string }) => post<AuthResponse>("/auth/signup", input),
  login: (input: { email: string; password: string }) => post<AuthResponse>("/auth/login", input),
  me: () => get<{ user: User }>("/auth/me"),

  // borrower
  getProfile: () => get<{ profile: BorrowerProfile | null }>("/borrower/profile"),
  saveProfile: (input: ProfileInput) => request<{ profile: BorrowerProfile }>("/borrower/profile", "PUT", input),
  uploadSalarySlip: (file: File) => {
    const form = new FormData();
    form.append("salarySlip", file);
    return post<{ profile: BorrowerProfile }>("/borrower/profile/salary-slip", form);
  },
  applyForLoan: (input: { amount: number; tenureDays: number }) => post<{ loan: Loan }>("/borrower/loans", input),
  myLoans: () => get<{ loans: Loan[] }>("/borrower/loans"),

  // sales
  salesLeads: () => get<{ leads: Lead[] }>("/sales/leads"),

  // sanction
  sanctionLoans: (status: LoanStatus) => get<{ loans: Loan[] }>(`/sanction/loans?status=${status}`),
  approveLoan: (id: string) => post<{ loan: Loan }>(`/sanction/loans/${id}/approve`),
  rejectLoan: (id: string, reason: string) => post<{ loan: Loan }>(`/sanction/loans/${id}/reject`, { reason }),
  // The slip endpoint needs the auth header, so fetch it as a blob and open that.
  async openSalarySlip(id: string) {
    const res = await send(`/sanction/loans/${id}/salary-slip`, "GET");
    window.open(URL.createObjectURL(await res.blob()), "_blank");
  },

  // disbursement
  disbursementLoans: (status: LoanStatus) => get<{ loans: Loan[] }>(`/disbursement/loans?status=${status}`),
  disburseLoan: (id: string) => post<{ loan: Loan }>(`/disbursement/loans/${id}/disburse`),

  // collection
  collectionLoans: (status: LoanStatus) => get<{ loans: Loan[] }>(`/collection/loans?status=${status}`),
  loanPayments: (id: string) => get<{ payments: Payment[] }>(`/collection/loans/${id}/payments`),
  recordPayment: (id: string, input: PaymentInput) =>
    post<{ payment: Payment; loan: Loan }>(`/collection/loans/${id}/payments`, input),
};
