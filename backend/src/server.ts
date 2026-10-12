import { app } from "./app";
import { assertRuntimeEnv, env } from "./config/env";
import { connectDb } from "./config/db";

async function start() {
  assertRuntimeEnv();
  await connectDb();
  app.listen(env.port, () => console.log(`LMS API listening on port ${env.port}`));
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
