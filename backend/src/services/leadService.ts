import { User } from "../models/User";
import { Loan } from "../models/Loan";
import { BorrowerProfile } from "../models/BorrowerProfile";

export type LeadStage = "REGISTERED" | "PROFILE_COMPLETED" | "SLIP_UPLOADED";

export function determineStage(profile: { salarySlip?: unknown } | undefined): LeadStage {
  if (!profile) return "REGISTERED";
  return profile.salarySlip ? "SLIP_UPLOADED" : "PROFILE_COMPLETED";
}

export class LeadService {
  constructor(
    private readonly userModel: typeof User,
    private readonly loanModel: typeof Loan,
    private readonly profileModel: typeof BorrowerProfile
  ) {}

  // Borrowers who have signed up but not yet applied for a loan.
  async listLeads() {
    const borrowersWithLoans = await this.loanModel.distinct("borrower");
    const borrowers = await this.userModel
      .find({ role: "borrower", _id: { $nin: borrowersWithLoans } })
      .sort({ createdAt: -1 });
    const profiles = await this.profileModel.find({ user: { $in: borrowers.map((b) => b._id) } });
    const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));

    return borrowers.map((borrower) => ({
      id: borrower.id,
      name: borrower.name,
      email: borrower.email,
      signedUpAt: borrower.createdAt,
      stage: determineStage(profileByUser.get(borrower.id)),
    }));
  }
}
