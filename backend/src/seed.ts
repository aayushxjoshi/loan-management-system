import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { assertRuntimeEnv } from "./config/env";
import { connectDb } from "./config/db";
import { Role } from "./config/constants";
import { User } from "./models/User";

const SEED_USERS: { name: string; email: string; password: string; role: Role }[] = [
  { name: "Admin", email: "admin@lms.com", password: "Admin@123", role: "admin" },
  { name: "Sales User", email: "sales@lms.com", password: "Sales@123", role: "sales" },
  { name: "Sanction User", email: "sanction@lms.com", password: "Sanction@123", role: "sanction" },
  { name: "Disbursement User", email: "disbursement@lms.com", password: "Disburse@123", role: "disbursement" },
  { name: "Collection User", email: "collection@lms.com", password: "Collect@123", role: "collection" },
  { name: "Demo Borrower", email: "borrower@lms.com", password: "Borrower@123", role: "borrower" },
];

export async function seedUsers(): Promise<void> {
  for (const { password, ...user } of SEED_USERS) {
    const passwordHash = await bcrypt.hash(password, 10);
    // $setOnInsert keeps the seed idempotent and leaves existing users untouched.
    await User.updateOne({ email: user.email }, { $setOnInsert: { ...user, passwordHash } }, { upsert: true });
  }
}

async function run() {
  assertRuntimeEnv();
  await connectDb();
  await seedUsers();
  console.log(`Seeded ${SEED_USERS.length} users`);
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
