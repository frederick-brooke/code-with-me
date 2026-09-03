import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;

if (!url) {
  console.log(
    "DATABASE_URL is not set; skipping prisma migrate deploy. " +
      "Local builds and env-less previews keep using the in-memory stores.",
  );
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

if (result.status !== 0) {
  console.error(`prisma migrate deploy failed with exit code ${result.status ?? "n/a"}`);
  process.exit(result.status ?? 1);
}

console.log("prisma migrate deploy completed.");