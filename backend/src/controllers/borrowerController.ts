import { Request, Response } from "express";
import { ProfileService } from "../services/profileService";
import { LoanService } from "../services/loanService";
import { loanApplicationSchema, profileSchema } from "./schemas";
import { parseOrThrow } from "../utils/validate";
import { AppError } from "../utils/AppError";

export class BorrowerController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly loanService: LoanService
  ) {}

  getProfile = async (req: Request, res: Response) => {
    res.json({ profile: await this.profileService.getProfile(req.auth!.id) });
  };

  saveProfile = async (req: Request, res: Response) => {
    const input = parseOrThrow(profileSchema, req.body);
    res.json({ profile: await this.profileService.saveProfile(req.auth!.id, input) });
  };

  uploadSalarySlip = async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest("salarySlip file is required");
    res.json({ profile: await this.profileService.attachSalarySlip(req.auth!.id, req.file) });
  };

  applyForLoan = async (req: Request, res: Response) => {
    const input = parseOrThrow(loanApplicationSchema, req.body);
    res.status(201).json({ loan: await this.loanService.applyForLoan(req.auth!.id, input) });
  };

  listLoans = async (req: Request, res: Response) => {
    res.json({ loans: await this.loanService.listBorrowerLoans(req.auth!.id) });
  };
}
