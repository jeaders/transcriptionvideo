// Inizializza il database PostgreSQL embedded (user-space, nessuna installazione):
// initdb se manca la cartella .pgdata, avvio se non attivo, creazione di app_db.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pg = path.join(root, "node_modules", "@embedded-postgres", "linux-x64", "native", "bin");
const data = path.join(root, ".pgdata");
const log = path.join(data, "postgres.log");
const URL_DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const dbName = new URL(URL_DB).pathname.replace(/^\//, "") || "app_db";

function pgCtl(args) {
  return execFileSync(path.join(pg, "pg_ctl"), ["-D", data, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// 1) initdb
if (!fs.existsSync(data)) {
  console.log("Inizializzazione cluster PostgreSQL in .pgdata …");
  execFileSync(path.join(pg, "initdb"), ["--auth=trust", "--username=postgres", "--pgdata=" + data, "-E", "UTF8"], { stdio: "inherit" });
}

// 2) avvio se non attivo
let running = false;
try {
  pgCtl(["status"]);
  running = true;
} catch {}
if (!running) {
  console.log("Avvio PostgreSQL …");
  pgCtl(["-l", log, "start"]);
}

// 3) creazione database
const { Client } = await import("pg").catch(() => ({}));
if (!Client) {
  console.warn("pkg pg non trovato: salta la creazione del database");
  process.exit(0);
}
const u = new URL(URL_DB);
const client = new Client({
  host: u.hostname,
  port: u.port || 5432,
  user: u.username || "postgres",
  password: decodeURIComponent(u.password ?? ""),
  database: "postgres",
});
await client.connect();
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
if (!exists.rowCount) {
  await client.query(`CREATE DATABASE ${dbName}`);
  console.log("Database creato:", dbName);
} else {
  console.log("Database già presente:", dbName);
}
await client.end();
