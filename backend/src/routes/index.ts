import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { uploadSalarySlip } from "../middleware/upload";
import { asyncHandler as wrap } from "../utils/asyncHandler";
import { Container } from "../container";

export function createRouter({ authController: auth, borrowerController: borrower, staffController: staff }: Container) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.post("/auth/signup", wrap(auth.signup));
  router.post("/auth/login", wrap(auth.login));
  router.get("/auth/me", authenticate, wrap(auth.me));

  const borrowerRouter = Router();
  borrowerRouter.use(authenticate, requireRole("borrower"));
  borrowerRouter.get("/profile", wrap(borrower.getProfile));
  borrowerRouter.put("/profile", wrap(borrower.saveProfile));
  borrowerRouter.post("/profile/salary-slip", uploadSalarySlip, wrap(borrower.uploadSalarySlip));
  borrowerRouter.post("/loans", wrap(borrower.applyForLoan));
  borrowerRouter.get("/loans", wrap(borrower.listLoans));
  router.use("/borrower", borrowerRouter);

  const salesRouter = Router();
  salesRouter.use(authenticate, requireRole("sales"));
  salesRouter.get("/leads", wrap(staff.listLeads));
  router.use("/sales", salesRouter);

  const sanctionRouter = Router();
  sanctionRouter.use(authenticate, requireRole("sanction"));
  sanctionRouter.get("/loans", wrap(staff.listLoans(["APPLIED", "SANCTIONED", "REJECTED"])));
  sanctionRouter.post("/loans/:id/approve", wrap(staff.approve));
  sanctionRouter.post("/loans/:id/reject", wrap(staff.reject));
  sanctionRouter.get("/loans/:id/salary-slip", wrap(staff.downloadSalarySlip));
  router.use("/sanction", sanctionRouter);

  const disbursementRouter = Router();
  disbursementRouter.use(authenticate, requireRole("disbursement"));
  disbursementRouter.get("/loans", wrap(staff.listLoans(["SANCTIONED", "DISBURSED"])));
  disbursementRouter.post("/loans/:id/disburse", wrap(staff.disburse));
  router.use("/disbursement", disbursementRouter);

  const collectionRouter = Router();
  collectionRouter.use(authenticate, requireRole("collection"));
  collectionRouter.get("/loans", wrap(staff.listLoans(["DISBURSED", "CLOSED"])));
  collectionRouter.get("/loans/:id/payments", wrap(staff.listPayments));
  collectionRouter.post("/loans/:id/payments", wrap(staff.recordPayment));
  router.use("/collection", collectionRouter);

  return router;
}
