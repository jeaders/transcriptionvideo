#!/usr/bin/env bash
# Launcher per Trascrivo (pacchetto .deb).
# Avvia PostgreSQL embedded per-utente, il server Next.js e apre il browser.
set -u

APP_DIR="/opt/trascrivo"
DATA_DIR="${HOME}/.local/share/trascrivo"
PGDATA="${DATA_DIR}/.pgdata"
PGPORT="${TRASCIRVO_PGPORT:-5433}"
PORT="${TRASCIRVO_PORT:-3000}"
LOG="${DATA_DIR}/trascrivo.log"

mkdir -p "$DATA_DIR"
PG_BIN="${APP_DIR}/node_modules/@embedded-postgres/linux-x64/native/bin"

# --- carica eventuali override utente (GROQ_API_KEY, PORT, ecc.) ---
if [ -f "${DATA_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${DATA_DIR}/.env"
  set +a
  PORT="${TRASCIRVO_PORT:-$PORT}"
  PGPORT="${TRASCIRVO_PGPORT:-$PGPORT}"
fi

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PGPORT}/app_db"
export PORT
export NODE_ENV="production"
export NEXT_TELEMETRY_DISABLED="1"
export NEXT_CACHE_DIR="${DATA_DIR}/.next-cache"

# --- initdb al primo avvio ---
if [ ! -d "${PGDATA}" ]; then
  echo "Primo avvio: inizializzo il database..." >> "$LOG"
  "${PG_BIN}/initdb" --auth=trust --username=postgres --pgdata="${PGDATA}" -E UTF8 >> "$LOG" 2>&1
  # porta personalizzata
  echo "port = ${PGPORT}" >> "${PGDATA}/postgresql.conf"
fi

# --- avvia Postgres se non attivo ---
if ! "${PG_BIN}/pg_ctl" -D "${PGDATA}" status >/dev/null 2>&1; then
  "${PG_BIN}/pg_ctl" -D "${PGDATA}" -l "${PGDATA}/postgres.log" start >> "$LOG" 2>&1
  sleep 1
fi

# --- crea il database app_db se manca ---
node -e "
const {Client}=require('${APP_DIR}/node_modules/pg');
(async()=>{const c=new Client({host:'127.0.0.1',port:${PGPORT},user:'postgres',password:'postgres',database:'postgres'});
await c.connect();const r=await c.query(\"SELECT 1 FROM pg_database WHERE datname='app_db'\");
if(!r.rowCount)await c.query('CREATE DATABASE app_db');await c.end();})().catch(e=>{console.error(e.message);process.exit(0);});
" >> "$LOG" 2>&1

# --- applica migrazioni schema ---
DATABASE_URL="$DATABASE_URL" node "${APP_DIR}/scripts/migrate.mjs" >> "$LOG" 2>&1

# --- avvia Next.js ---
cd "$APP_DIR"
node "${APP_DIR}/node_modules/.bin/next" start >> "$LOG" 2>&1 &
NEXT_PID=$!

cleanup() {
  kill "$NEXT_PID" 2>/dev/null
  "${PG_BIN}/pg_ctl" -D "${PGDATA}" stop -m fast >/dev/null 2>&1
}
trap cleanup EXIT INT TERM

# --- attendi che il server sia pronto ---
for i in $(seq 1 40); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/api/health"; then break; fi
  sleep 0.5
done

# --- apri il browser ---
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:${PORT}" >/dev/null 2>&1 &
fi

wait "$NEXT_PID"
