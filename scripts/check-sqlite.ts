import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ensureSqliteSchema } from '../src/db/bootstrapSqlite';

const configuredPath = process.env.SQLITE_DB_PATH || path.join('data', 'humanitybridge.db');
const databasePath = configuredPath === ':memory:' ? configuredPath : path.resolve(process.cwd(), configuredPath);

if (databasePath !== ':memory:') {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const sqlite = new DatabaseSync(databasePath);

try {
  ensureSqliteSchema(sqlite);

  const integrity = sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  if (integrity.integrity_check !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity.integrity_check}`);
  }

  const foreignKeyViolations = sqlite.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyViolations.length > 0) {
    throw new Error(`SQLite contains ${foreignKeyViolations.length} foreign-key violation(s).`);
  }

  const tableCount = sqlite.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).get() as { count: number };

  console.log('SQLite database check passed.');
  console.log(`Database: ${databasePath}`);
  console.log(`Tables: ${tableCount.count}`);
  console.log('Integrity: ok');
  console.log('Foreign keys: ok');
} finally {
  sqlite.close();
}
