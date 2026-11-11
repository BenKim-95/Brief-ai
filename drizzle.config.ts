import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local the way Next.js does. Load it here so
// `npm run db:generate` / `npm run db:migrate` work without extra flags.
// Variables already set in the shell take precedence.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (.env.local or shell env)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
