import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/app";
import { seedUsers } from "../src/seed";
import { User } from "../src/models/User";
import { Payment } from "../src/models/Payment";
import { Loan } from "../src/models/Loan";
import { UPLOAD_DIR } from "../src/middleware/upload";
import fs from "fs";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Payment.init()]);
});

afterAll(async () => {
  // Remove salary slips written by the tests.
  fs.readdirSync(UPLOAD_DIR)
    .filter((name) => name.endsWith(".pdf"))
    .forEach((name) => fs.unlinkSync(UPLOAD_DIR + "/" + name));
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Payment.init()]);
  await seedUsers();
});

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

const staff = {
  sanction: () => login("sanction@lms.com", "Sanction@123"),
  disbursement: () => login("disbursement@lms.com", "Disburse@123"),
  collection: () => login("collection@lms.com", "Collect@123"),
  sales: () => login("sales@lms.com", "Sales@123"),
  admin: () => login("admin@lms.com", "Admin@123"),
};

const validProfile = {
  fullName: "Test Borrower",
  pan: "abcde1234f",
  dateOfBirth: "1995-01-01",
  monthlySalary: 50000,
  employmentMode: "SALARIED",
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Signs up a borrower, completes the profile, uploads a slip and returns the token.
async function readyBorrower(email = "b1@test.com"): Promise<string> {
  const signup = await request(app).post("/api/auth/signup").send({ name: "B One", email, password: "password1" });
  const token = signup.body.token as string;
  await request(app).put("/api/borrower/profile").set(auth(token)).send(validProfile).expect(200);
  await request(app)
    .post("/api/borrower/profile/salary-slip")
    .set(auth(token))
    .attach("salarySlip", Buffer.from("%PDF-1.4 test"), { filename: "slip.pdf", contentType: "application/pdf" })
    .expect(200);
  return token;
}

async function disbursedLoan(amount = 50000, tenureDays = 365) {
  const borrower = await readyBorrower();
  const created = await request(app).post("/api/borrower/loans").set(auth(borrower)).send({ amount, tenureDays });
  const loanId = created.body.loan.id as string;
  await request(app).post(`/api/sanction/loans/${loanId}/approve`).set(auth(await staff.sanction())).expect(200);
  await request(app).post(`/api/disbursement/loans/${loanId}/disburse`).set(auth(await staff.disbursement())).expect(200);
  return { loanId, borrower };
}

const pay = (loanId: string, token: string, body: object) =>
  request(app).post(`/api/collection/loans/${loanId}/payments`).set(auth(token)).send(body);

describe("auth and RBAC", () => {
  it("signup creates a borrower and rejects duplicate email", async () => {
    const body = { name: "X", email: "X@Test.com", password: "password1" };
    const first = await request(app).post("/api/auth/signup").send(body);
    expect(first.status).toBe(201);
    expect(first.body.user).toMatchObject({ email: "x@test.com", role: "borrower" });
    expect(first.body.user.passwordHash).toBeUndefined();
    expect((await request(app).post("/api/auth/signup").send(body)).status).toBe(409);
  });

  it("rejects short passwords with 400 and bad login with 401", async () => {
    const short = await request(app).post("/api/auth/signup").send({ name: "X", email: "x@test.com", password: "short" });
    expect(short.status).toBe(400);
    const bad = await request(app).post("/api/auth/login").send({ email: "admin@lms.com", password: "wrong" });
    expect(bad.status).toBe(401);
  });

  it("GET /auth/me returns the user", async () => {
    const res = await request(app).get("/api/auth/me").set(auth(await staff.sales()));
    expect(res.body.user).toMatchObject({ email: "sales@lms.com", role: "sales" });
  });

  it("returns 401 without a valid token", async () => {
    expect((await request(app).get("/api/sales/leads")).status).toBe(401);
    expect((await request(app).get("/api/sales/leads").set(auth("garbage"))).status).toBe(401);
  });

  it("returns 403 for the wrong role", async () => {
    expect((await request(app).get("/api/sales/leads").set(auth(await staff.sanction()))).status).toBe(403);
    const borrower = await readyBorrower();
    expect((await request(app).get("/api/sanction/loans").set(auth(borrower))).status).toBe(403);
    expect((await request(app).get("/api/borrower/loans").set(auth(await staff.sales()))).status).toBe(403);
  });

  it("lets admin into every module", async () => {
    const admin = await staff.admin();
    for (const url of ["/api/sales/leads", "/api/sanction/loans", "/api/disbursement/loans", "/api/collection/loans"]) {
      expect((await request(app).get(url).set(auth(admin))).status).toBe(200);
    }
  });
});

describe("borrower journey", () => {
  it("returns 422 with all BRE errors and saves nothing", async () => {
    const token = (await request(app).post("/api/auth/signup").send({ name: "Y", email: "y@test.com", password: "password1" })).body.token;
    const res = await request(app)
      .put("/api/borrower/profile")
      .set(auth(token))
      .send({ ...validProfile, pan: "bad", monthlySalary: 1000, employmentMode: "UNEMPLOYED" });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Not eligible");
    expect(res.body.errors).toHaveLength(3);
    const profile = await request(app).get("/api/borrower/profile").set(auth(token));
    expect(profile.body.profile).toBeNull();
  });

  it("uppercases PAN and requires profile + slip before applying", async () => {
    const token = (await request(app).post("/api/auth/signup").send({ name: "Y", email: "y@test.com", password: "password1" })).body.token;
    const apply = { amount: 100000, tenureDays: 90 };
    expect((await request(app).post("/api/borrower/loans").set(auth(token)).send(apply)).status).toBe(400);
    const saved = await request(app).put("/api/borrower/profile").set(auth(token)).send(validProfile);
    expect(saved.body.profile.pan).toBe("ABCDE1234F");
    expect((await request(app).post("/api/borrower/loans").set(auth(token)).send(apply)).status).toBe(400);
  });

  it("rejects non-pdf/image uploads", async () => {
    const token = (await request(app).post("/api/auth/signup").send({ name: "Y", email: "y@test.com", password: "password1" })).body.token;
    await request(app).put("/api/borrower/profile").set(auth(token)).send(validProfile);
    const res = await request(app)
      .post("/api/borrower/profile/salary-slip")
      .set(auth(token))
      .attach("salarySlip", Buffer.from("hi"), { filename: "a.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("creates a loan with computed repayment and blocks a second open loan", async () => {
    const token = await readyBorrower();
    const first = await request(app).post("/api/borrower/loans").set(auth(token)).send({ amount: 100000, tenureDays: 365 });
    expect(first.status).toBe(201);
    expect(first.body.loan).toMatchObject({ interest: 12000, totalRepayment: 112000, totalPaid: 0, outstanding: 112000, status: "APPLIED" });
    const second = await request(app).post("/api/borrower/loans").set(auth(token)).send({ amount: 100000, tenureDays: 90 });
    expect(second.status).toBe(409);
  });

  it("validates loan amount and tenure", async () => {
    const token = await readyBorrower();
    expect((await request(app).post("/api/borrower/loans").set(auth(token)).send({ amount: 1000, tenureDays: 90 })).status).toBe(400);
    expect((await request(app).post("/api/borrower/loans").set(auth(token)).send({ amount: 100000, tenureDays: 10 })).status).toBe(400);
  });

  it("shows borrowers as sales leads until they apply", async () => {
    const token = await readyBorrower();
    const sales = await staff.sales();
    const before = await request(app).get("/api/sales/leads").set(auth(sales));
    expect(before.body.leads.find((l: { email: string }) => l.email === "b1@test.com").stage).toBe("SLIP_UPLOADED");
    expect(before.body.leads.find((l: { email: string }) => l.email === "borrower@lms.com").stage).toBe("REGISTERED");
    await request(app).post("/api/borrower/loans").set(auth(token)).send({ amount: 100000, tenureDays: 90 });
    const after = await request(app).get("/api/sales/leads").set(auth(sales));
    expect(after.body.leads.find((l: { email: string }) => l.email === "b1@test.com")).toBeUndefined();
  });
});

describe("loan workflow", () => {
  it("runs sanction -> disbursement and enforces transitions with 409", async () => {
    const borrower = await readyBorrower();
    const { body } = await request(app).post("/api/borrower/loans").set(auth(borrower)).send({ amount: 100000, tenureDays: 90 });
    const id = body.loan.id;
    const sanction = await staff.sanction();
    const disbursement = await staff.disbursement();

    expect((await request(app).post(`/api/disbursement/loans/${id}/disburse`).set(auth(disbursement))).status).toBe(409);

    const list = await request(app).get("/api/sanction/loans").set(auth(sanction));
    expect(list.body.loans[0]).toMatchObject({ borrower: { email: "b1@test.com" }, profile: { pan: "ABCDE1234F" } });

    const slip = await request(app).get(`/api/sanction/loans/${id}/salary-slip`).set(auth(sanction));
    expect(slip.status).toBe(200);

    expect((await request(app).post(`/api/sanction/loans/${id}/approve`).set(auth(sanction))).body.loan.status).toBe("SANCTIONED");
    expect((await request(app).post(`/api/sanction/loans/${id}/reject`).set(auth(sanction)).send({ reason: "x" })).status).toBe(409);
    expect((await request(app).post(`/api/disbursement/loans/${id}/disburse`).set(auth(disbursement))).body.loan.status).toBe("DISBURSED");
  });

  it("requires a reason to reject, then allows a new application", async () => {
    const borrower = await readyBorrower();
    const { body } = await request(app).post("/api/borrower/loans").set(auth(borrower)).send({ amount: 100000, tenureDays: 90 });
    const sanction = await staff.sanction();
    const url = `/api/sanction/loans/${body.loan.id}/reject`;
    expect((await request(app).post(url).set(auth(sanction)).send({})).status).toBe(400);
    const rejected = await request(app).post(url).set(auth(sanction)).send({ reason: "Low score" });
    expect(rejected.body.loan).toMatchObject({ status: "REJECTED", rejectionReason: "Low score" });
    const again = await request(app).post("/api/borrower/loans").set(auth(borrower)).send({ amount: 60000, tenureDays: 60 });
    expect(again.status).toBe(201);
  });
});

describe("payments", () => {
  it("records a partial payment and updates outstanding", async () => {
    const { loanId } = await disbursedLoan(); // total 56000
    const collection = await staff.collection();
    const res = await pay(loanId, collection, { utr: " utr001 ", amount: 6000, paidOn: "2026-01-01" });
    expect(res.status).toBe(201);
    expect(res.body.payment.utr).toBe("UTR001");
    expect(res.body.loan).toMatchObject({ totalPaid: 6000, outstanding: 50000, status: "DISBURSED" });
    const list = await request(app).get(`/api/collection/loans/${loanId}/payments`).set(auth(collection));
    expect(list.body.payments).toHaveLength(1);
  });

  it("rejects duplicate UTR globally with 409", async () => {
    const { loanId } = await disbursedLoan();
    const collection = await staff.collection();
    await pay(loanId, collection, { utr: "UTR001", amount: 100, paidOn: "2026-01-01" }).expect(201);
    const dup = await pay(loanId, collection, { utr: "utr001", amount: 100, paidOn: "2026-01-02" });
    expect(dup.status).toBe(409);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it("rejects overpayment, bad amounts and future dates with 400", async () => {
    const { loanId } = await disbursedLoan();
    const collection = await staff.collection();
    expect((await pay(loanId, collection, { utr: "A1", amount: 56000.01, paidOn: "2026-01-01" })).status).toBe(400);
    expect((await pay(loanId, collection, { utr: "A2", amount: 0, paidOn: "2026-01-01" })).status).toBe(400);
    expect((await pay(loanId, collection, { utr: "  ", amount: 10, paidOn: "2026-01-01" })).status).toBe(400);
    expect((await pay(loanId, collection, { utr: "A3", amount: 10, paidOn: "2999-01-01" })).status).toBe(400);
    expect((await pay(loanId, collection, { utr: "A4", amount: 10, paidOn: "not-a-date" })).status).toBe(400);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it("auto-closes the loan when fully paid, then refuses more payments", async () => {
    const { loanId } = await disbursedLoan();
    const collection = await staff.collection();
    await pay(loanId, collection, { utr: "P1", amount: 20000.5, paidOn: "2026-01-01" }).expect(201);
    const final = await pay(loanId, collection, { utr: "P2", amount: 35999.5, paidOn: "2026-01-02" });
    expect(final.body.loan).toMatchObject({ status: "CLOSED", outstanding: 0, totalPaid: 56000 });
    expect((await Loan.findById(loanId))?.closedAt).toBeTruthy();
    expect((await pay(loanId, collection, { utr: "P3", amount: 1, paidOn: "2026-01-03" })).status).toBe(409);
  });

  it("refuses payments on loans that are not disbursed", async () => {
    const borrower = await readyBorrower();
    const { body } = await request(app).post("/api/borrower/loans").set(auth(borrower)).send({ amount: 100000, tenureDays: 90 });
    const res = await pay(body.loan.id, await staff.collection(), { utr: "Z1", amount: 10, paidOn: "2026-01-01" });
    expect(res.status).toBe(409);
  });

  it("only lets collection (and admin) record payments", async () => {
    const { loanId } = await disbursedLoan();
    const res = await pay(loanId, await staff.sanction(), { utr: "Q1", amount: 10, paidOn: "2026-01-01" });
    expect(res.status).toBe(403);
  });
});
