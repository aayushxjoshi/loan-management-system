import { Request, Response } from "express";
import { LoanService } from "../services/loanService";
import { PaymentService } from "../services/paymentService";
import { LeadService } from "../services/leadService";
import { paymentSchema, rejectSchema, statusQuerySchema } from "./schemas";
import { assertObjectId, parseOrThrow } from "../utils/validate";
import { LoanStatus } from "../config/constants";

function loanIdParam(req: Request): string {
  const id = String(req.params.id);
  assertObjectId(id);
  return id;
}

export class StaffController {
  constructor(
    private readonly loanService: LoanService,
    private readonly paymentService: PaymentService,
    private readonly leadService: LeadService
  ) {}

  // Builds a list handler for a dashboard. The first status is the default.
  listLoans<T extends [LoanStatus, ...LoanStatus[]]>(allowedStatuses: T) {
    const querySchema = statusQuerySchema(allowedStatuses);
    return async (req: Request, res: Response) => {
      const { status } = parseOrThrow(querySchema, req.query);
      res.json({ loans: await this.loanService.listLoansByStatus((status ?? allowedStatuses[0]) as LoanStatus) });
    };
  }

  listLeads = async (_req: Request, res: Response) => {
    res.json({ leads: await this.leadService.listLeads() });
  };

  approve = async (req: Request, res: Response) => {
    res.json({ loan: await this.loanService.approveLoan(loanIdParam(req), req.auth!.id) });
  };

  reject = async (req: Request, res: Response) => {
    const { reason } = parseOrThrow(rejectSchema, req.body);
    res.json({ loan: await this.loanService.rejectLoan(loanIdParam(req), req.auth!.id, reason) });
  };

  disburse = async (req: Request, res: Response) => {
    res.json({ loan: await this.loanService.disburseLoan(loanIdParam(req), req.auth!.id) });
  };

  listPayments = async (req: Request, res: Response) => {
    res.json({ payments: await this.paymentService.listPayments(loanIdParam(req)) });
  };

  recordPayment = async (req: Request, res: Response) => {
    const input = parseOrThrow(paymentSchema, req.body);
    const result = await this.paymentService.recordPayment(loanIdParam(req), req.auth!.id, input);
    res.status(201).json(result);
  };

  downloadSalarySlip = async (req: Request, res: Response) => {
    const { filePath, originalName, mimeType } = await this.loanService.getSalarySlipFile(loanIdParam(req));
    res.type(mimeType);
    res.download(filePath, originalName);
  };
}
