import { User } from "./models/User";
import { Loan } from "./models/Loan";
import { Payment } from "./models/Payment";
import { BorrowerProfile } from "./models/BorrowerProfile";
import { AgeRule, EmploymentRule, PanRule, SalaryRule } from "./bre/rules";
import { EligibilityEngine } from "./bre/eligibilityEngine";
import { LoanStateMachine } from "./services/loanStateMachine";
import { AuthService } from "./services/authService";
import { ProfileService } from "./services/profileService";
import { LoanService } from "./services/loanService";
import { PaymentService } from "./services/paymentService";
import { LeadService } from "./services/leadService";
import { AuthController } from "./controllers/authController";
import { BorrowerController } from "./controllers/borrowerController";
import { StaffController } from "./controllers/staffController";

// Composition root: the only place that wires classes together.
export function buildContainer() {
  // To add an eligibility rule, write a new class and add one line here.
  const eligibilityEngine = new EligibilityEngine([
    new AgeRule(),
    new SalaryRule(),
    new PanRule(),
    new EmploymentRule(),
  ]);
  const stateMachine = new LoanStateMachine();

  const authService = new AuthService(User);
  const profileService = new ProfileService(BorrowerProfile, eligibilityEngine);
  const loanService = new LoanService(Loan, BorrowerProfile, stateMachine);
  const paymentService = new PaymentService(Loan, Payment, loanService, stateMachine);
  const leadService = new LeadService(User, Loan, BorrowerProfile);

  return {
    authController: new AuthController(authService),
    borrowerController: new BorrowerController(profileService, loanService),
    staffController: new StaffController(loanService, paymentService, leadService),
  };
}

export type Container = ReturnType<typeof buildContainer>;
