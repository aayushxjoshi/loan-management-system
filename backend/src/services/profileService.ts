import { BorrowerProfile } from "../models/BorrowerProfile";
import { EligibilityEngine } from "../bre/eligibilityEngine";
import { EmploymentMode } from "../config/constants";
import { AppError } from "../utils/AppError";

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
    private readonly eligibilityEngine: EligibilityEngine
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

  async attachSalarySlip(
    userId: string,
    file: { filename: string; originalname: string; mimetype: string; size: number }
  ) {
    const profile = await this.profileModel.findOneAndUpdate(
      { user: userId },
      {
        salarySlip: {
          path: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      },
      { returnDocument: "after" }
    );
    if (!profile) throw AppError.badRequest("Complete your profile before uploading a salary slip");
    return profile;
  }
}
