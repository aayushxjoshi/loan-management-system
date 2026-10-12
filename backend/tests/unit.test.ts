import { describe, expect, it } from "vitest";
import { calculateRepayment, roundMoney } from "../src/utils/loanMath";
import { EligibilityEngine } from "../src/bre/eligibilityEngine";
import { AgeRule, EmploymentRule, EligibilityRule, PanRule, SalaryRule, calculateAge } from "../src/bre/rules";
import { LoanStateMachine } from "../src/services/loanStateMachine";
import { validatePayment } from "../src/services/paymentService";
import { LoanStatus } from "../src/config/constants";

const today = new Date("2026-06-15T00:00:00Z");
const engine = new EligibilityEngine([new AgeRule(), new SalaryRule(), new PanRule(), new EmploymentRule()]);
const stateMachine = new LoanStateMachine();
const goodProfile = {
  dateOfBirth: new Date("1995-01-01T00:00:00Z"),
  monthlySalary: 40000,
  pan: "ABCDE1234F",
  employmentMode: "SALARIED" as const,
};

describe("loan math", () => {
  it("calculates simple interest at 12% per year", () => {
    expect(calculateRepayment(100000, 365)).toEqual({ interestRate: 12, interest: 12000, totalRepayment: 112000 });
  });

  it("prorates by tenure days and rounds to 2 decimals", () => {
    const result = calculateRepayment(50000, 30);
    expect(result.interest).toBe(493.15);
    expect(result.totalRepayment).toBe(50493.15);
  });

  it("rounds money to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.1 + 0.2)).toBe(10.3);
  });
});

describe("BRE", () => {
  it("passes an eligible profile", () => {
    expect(engine.evaluate(goodProfile, today)).toEqual([]);
  });

  it("computes age with birthday not yet reached", () => {
    expect(calculateAge(new Date("2000-06-16T00:00:00Z"), today)).toBe(25);
    expect(calculateAge(new Date("2000-06-15T00:00:00Z"), today)).toBe(26);
  });

  it("treats age 23 and 50 as inclusive, 22 and 51 as rejected", () => {
    const withAge = (dob: string) => engine.evaluate({ ...goodProfile, dateOfBirth: new Date(dob) }, today);
    expect(withAge("2003-06-15T00:00:00Z")).toEqual([]);
    expect(withAge("1976-06-15T00:00:00Z")).toEqual([]);
    expect(withAge("2003-06-16T00:00:00Z")).toHaveLength(1);
    expect(withAge("1975-06-14T00:00:00Z")).toHaveLength(1);
  });

  it("enforces minimum salary of 25000 inclusive", () => {
    expect(engine.evaluate({ ...goodProfile, monthlySalary: 25000 }, today)).toEqual([]);
    expect(engine.evaluate({ ...goodProfile, monthlySalary: 24999 }, today)).toHaveLength(1);
  });

  it("validates PAN format, case-insensitively", () => {
    expect(engine.evaluate({ ...goodProfile, pan: "abcde1234f" }, today)).toEqual([]);
    expect(engine.evaluate({ ...goodProfile, pan: "ABCD12345F" }, today)).toHaveLength(1);
  });

  it("rejects unemployed applicants", () => {
    expect(engine.evaluate({ ...goodProfile, employmentMode: "UNEMPLOYED" }, today)).toHaveLength(1);
  });

  it("returns all failures together", () => {
    const failures = engine.evaluate(
      { dateOfBirth: new Date("2010-01-01T00:00:00Z"), monthlySalary: 100, pan: "bad", employmentMode: "UNEMPLOYED" },
      today
    );
    expect(failures).toHaveLength(4);
  });

  it("supports extra rules by config", () => {
    const extra: EligibilityRule = { name: "always-fail", check: () => "nope" };
    expect(new EligibilityEngine([extra]).evaluate(goodProfile, today)).toEqual(["nope"]);
  });
});

describe("loan status transitions", () => {
  const allStatuses = Object.keys(stateMachine.ALLOWED_TRANSITIONS) as LoanStatus[];

  it.each([
    ["APPLIED", "SANCTIONED"],
    ["APPLIED", "REJECTED"],
    ["SANCTIONED", "DISBURSED"],
    ["DISBURSED", "CLOSED"],
  ] as [LoanStatus, LoanStatus][])("allows %s -> %s", (from, to) => {
    expect(stateMachine.transition({ status: from }, to).status).toBe(to);
  });

  it("rejects every transition not in the map with a 409", () => {
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (stateMachine.ALLOWED_TRANSITIONS[from].includes(to)) continue;
        expect(() => stateMachine.transition({ status: from }, to)).toThrow(expect.objectContaining({ status: 409 }));
      }
    }
  });
});

describe("validatePayment", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const valid = { utr: "UTR1", amount: 100, paidOn: new Date("2026-06-15T00:00:00Z") };

  it("accepts a valid payment up to the outstanding amount", () => {
    expect(validatePayment({ outstanding: 100 }, valid, now)).toEqual([]);
  });

  it("rejects overpayment, zero amount, empty UTR and future date", () => {
    expect(validatePayment({ outstanding: 50 }, valid, now)).toHaveLength(1);
    expect(validatePayment({ outstanding: 50 }, { ...valid, amount: 0 }, now)).toHaveLength(1);
    expect(validatePayment({ outstanding: 500 }, { ...valid, utr: "" }, now)).toHaveLength(1);
    expect(validatePayment({ outstanding: 500 }, { ...valid, paidOn: new Date("2026-06-16T00:00:00Z") }, now)).toHaveLength(1);
  });
});
