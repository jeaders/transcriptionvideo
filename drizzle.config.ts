import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// Legge .env.local (formato Next) per non dipendere da dotenv del runtime CLI
function loadEnvLocal(): string | undefined {
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return undefined;
  return fs.readFileSync(file, "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
}

const url = process.env.DATABASE_URL ?? loadEnvLocal() ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
