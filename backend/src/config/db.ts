import mongoose from "mongoose";
import { env } from "./env";

export async function connectDb(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
}
