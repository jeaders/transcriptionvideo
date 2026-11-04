// Applica le migrazioni generate da drizzle-kit (cartella ./drizzle) al database in DATABASE_URL.
// Per host remoti (Supabase/Neon/Render) usa SSL; per 127.0.0.1/localhost no.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL mancante");
  process.exit(1);
}

let host = null;
try {
  host = new URL(url).hostname;
} catch {}
const isLocal = !host || host === "localhost" || host === "127.0.0.1" || host === "::1";

const pool = new Pool({
  connectionString: url,
  max: 1,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

const db = drizzle(pool);
try {
  await migrate(db, { migrationsFolder: path.join(root, "drizzle") });
  console.log("[migrate] schema applicato su", isLocal ? "db locale" : host);
} catch (e) {
  console.error("[migrate] errore:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
