import { EligibilityProfile, EligibilityRule } from "./rules";

export class EligibilityEngine {
  constructor(private readonly rules: EligibilityRule[]) {}

  // Runs every rule and returns all failure messages (empty array = eligible).
  evaluate(profile: EligibilityProfile, today: Date = new Date()): string[] {
    return this.rules
      .map((rule) => rule.check(profile, today))
      .filter((failure): failure is string => failure !== null);
  }
}
