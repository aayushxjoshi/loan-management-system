import { EmploymentMode } from "../config/constants";

export interface EligibilityProfile {
  dateOfBirth: Date;
  monthlySalary: number;
  pan: string;
  employmentMode: EmploymentMode;
}

// A rule returns a failure message, or null when the profile passes.
export interface EligibilityRule {
  name: string;
  check(profile: EligibilityProfile, today: Date): string | null;
}

export const MIN_AGE = 23;
export const MAX_AGE = 50;
export const MIN_SALARY = 25000;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function calculateAge(dateOfBirth: Date, today: Date): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (today.getUTCMonth() === dateOfBirth.getUTCMonth() && today.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export class AgeRule implements EligibilityRule {
  name = "age";

  check(profile: EligibilityProfile, today: Date): string | null {
    const age = calculateAge(profile.dateOfBirth, today);
    return age >= MIN_AGE && age <= MAX_AGE ? null : `Age must be between ${MIN_AGE} and ${MAX_AGE} years`;
  }
}

export class SalaryRule implements EligibilityRule {
  name = "salary";

  check(profile: EligibilityProfile): string | null {
    return profile.monthlySalary >= MIN_SALARY ? null : `Monthly salary must be at least ${MIN_SALARY}`;
  }
}

export class PanRule implements EligibilityRule {
  name = "pan";

  check(profile: EligibilityProfile): string | null {
    return PAN_PATTERN.test(profile.pan.toUpperCase()) ? null : "PAN must match the format ABCDE1234F";
  }
}

export class EmploymentRule implements EligibilityRule {
  name = "employment";

  check(profile: EligibilityProfile): string | null {
    return profile.employmentMode !== "UNEMPLOYED" ? null : "Unemployed applicants are not eligible";
  }
}
