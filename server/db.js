// server/db.js
// Unified asynchronous database abstraction supporting local SQLite (via libsql file URL) and hosted Turso.
// This module replaces the previous synchronous DatabaseSync usage.

import { createClient } from '@libsql/client';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve project root relative to this file.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Determine the database URL.
// In production, TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be provided.
// In development, fall back to a local file path (data/inuguration.sqlite).
function getDatabaseUrl() {
  const envUrl = process.env.TURSO_DATABASE_URL;
  if (envUrl && !envUrl.includes('your-database-name') && process.env.TURSO_AUTH_TOKEN) {
    return envUrl;
  }
  // Local SQLite file – libsql accepts a "file:" URL.
  const dbPath = resolve(projectRoot, process.env.DB_PATH || 'data/inuguration.sqlite');
  // Ensure directory exists.
  mkdirSync(dirname(dbPath), { recursive: true });
  return `file:${dbPath}`;
}

// Create and cache the client.
let client = null;
export function getDbClient() {
  if (client) return client;
  const url = getDatabaseUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({ url, authToken });
  return client;
}

// Helper wrappers that mirror the sqlite3 API used in the codebase.
export async function exec(sql, params = []) {
  const c = getDbClient();
  // libsql client execute supports a single statement. Split multi‑statement scripts.
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    // Params are not used for schema statements; ignore them.
    await c.execute(stmt);
  }
}


export async function run(sql, params = []) {
  const c = getDbClient();
  const result = await c.execute(sql, params);
  // libsql returns { rowsAffected, lastInsertRowid }
  return {
    changes: result.rowsAffected,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

export async function get(sql, params = []) {
  const c = getDbClient();
  const rows = await c.execute({ sql, args: params });
  return rows.rows?.[0] ?? null;
}

export async function all(sql, params = []) {
  const c = getDbClient();
  const rows = await c.execute({ sql, args: params });
  return rows.rows ?? [];
}

// Transaction wrapper – executes the supplied async function within a transaction.
export async function transaction(fn) {
  const c = getDbClient();
  await c.batch(async (tx) => {
    const execTx = async (sql, params = []) => await tx.execute(sql, params);
    const runTx = async (sql, params = []) => {
      const res = await tx.execute(sql, params);
      return { changes: res.rowsAffected, lastInsertRowid: Number(res.lastInsertRowid) };
    };
    const getTx = async (sql, params = []) => {
      const r = await tx.execute({ sql, args: params });
      return r.rows?.[0] ?? null;
    };
    const allTx = async (sql, params = []) => {
      const r = await tx.execute({ sql, args: params });
      return r.rows ?? [];
    };
    const dbTx = { exec: execTx, run: runTx, get: getTx, all: allTx };
    return await fn(dbTx);
  });
}

// Export a db-like object mimicking the old synchronous API.
export const db = {
  exec,
  run,
  get,
  all,
  prepare(sql) {
    return {
      async run(...params) { return await run(sql, params); },
      async get(...params) { return await get(sql, params); },
      async all(...params) { return await all(sql, params); },
    };
  },
  transaction,
};