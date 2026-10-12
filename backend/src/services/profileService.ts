import { BorrowerProfile } from "../models/BorrowerProfile";
import { EligibilityEngine } from "../bre/eligibilityEngine";
import { EmploymentMode } from "../config/constants";
import { AppError } from "../utils/AppError";
import { SalarySlipService, UploadedSlip } from "./salarySlipService";

export interface ProfileInput {
  fullName: string;
  pan: string;
  dateOfBirth: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export class ProfileService {
  constructor(
    private readonly profileModel: typeof BorrowerProfile,
    private readonly eligibilityEngine: EligibilityEngine,
    private readonly salarySlipService: SalarySlipService
  ) {}

  getProfile(userId: string) {
    return this.profileModel.findOne({ user: userId });
  }

  async saveProfile(userId: string, input: ProfileInput) {
    const pan = input.pan.trim().toUpperCase();
    const failures = this.eligibilityEngine.evaluate({ ...input, pan });
    if (failures.length > 0) throw AppError.notEligible(failures);

    return this.profileModel.findOneAndUpdate(
      { user: userId },
      { $set: { ...input, pan, user: userId } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
    );
  }

  async attachSalarySlip(userId: string, file: UploadedSlip) {
    const hasProfile = await this.profileModel.exists({ user: userId });
    if (!hasProfile) throw AppError.badRequest("Complete your profile before uploading a salary slip");

    const stored = await this.salarySlipService.save(userId, file);
    const profile = await this.profileModel.findOneAndUpdate(
      { user: userId },
      {
        salarySlip: {
          fileId: stored.id,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
        },
      },
      { returnDocument: "after" }
    );
    await this.salarySlipService.deleteOthers(userId, stored.id);
    return profile;
  }
}
