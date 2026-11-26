import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as sqliteSchema from './schema/sqlite/index';
import * as mysqlSchema from './schema/mysql/index';
import { ensureSqliteSchema } from './bootstrapSqlite';

export type DbDialect = 'mysql' | 'sqlite';

const mysqlUrl = process.env.DATABASE_URL?.startsWith('mysql://') ? process.env.DATABASE_URL : '';

if (process.env.NODE_ENV === 'production' && (!mysqlUrl || process.env.USE_MYSQL !== 'true')) {
  throw new Error('Production database configuration is invalid: MySQL is required.');
}

let activeDialect: DbDialect = 'sqlite';
let sqliteInstance: DatabaseSync | null = null;
let mysqlPool: mysql.Pool | null = null;

function sanitizeParams(params: unknown[]): SQLInputValue[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    return p as SQLInputValue;
  });
}

function createSqliteDb() {
  const dbDir = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = process.env.SQLITE_DB_PATH || path.join(dbDir, 'humanitybridge.db');
  sqliteInstance = new DatabaseSync(dbPath);
  ensureSqliteSchema(sqliteInstance);

  return drizzleSqliteProxy(
    async (sql, params, method) => {
      if (!sqliteInstance) {
        throw new Error('SQLite database not initialized');
      }
      const stmt = sqliteInstance.prepare(sql);
      const cleanParams = sanitizeParams(params);
      if (method === 'run') {
        const result = stmt.run(...cleanParams);
        return { rows: [], rowsAffected: Number(result.changes) };
      }
      stmt.setReturnArrays(true);
      if (method === 'get') {
        const row = stmt.get(...cleanParams);
        return { rows: row as unknown as unknown[] };
      }
      const rows = stmt.all(...cleanParams) as unknown as unknown[][];
      return { rows };
    },
    { schema: sqliteSchema },
  );
}

function createMysqlDb() {
  mysqlPool = mysql.createPool({
    uri: mysqlUrl,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
  });
  return drizzleMysql(mysqlPool, { schema: mysqlSchema, mode: 'default' });
}

// Type-unified handle: both MySQL and SQLite schemas mirror identical column property names.
// Select dialect-specific Drizzle descriptors at runtime. Both schemas expose
// the same logical table/property names, while each dialect retains its own SQL types.
export const schema = (
  mysqlUrl && process.env.USE_MYSQL === 'true' ? mysqlSchema : sqliteSchema
) as typeof sqliteSchema;
export const mysqlTables = mysqlSchema;

let dbInstance: ReturnType<typeof createSqliteDb>;

if (mysqlUrl && process.env.USE_MYSQL === 'true') {
  activeDialect = 'mysql';
  // Cast to unified Drizzle interface so repository services share identical query code
  dbInstance = createMysqlDb() as unknown as ReturnType<typeof createSqliteDb>;
} else {
  activeDialect = 'sqlite';
  dbInstance = createSqliteDb();
}

export const db = dbInstance;

export async function checkDatabaseConnection(): Promise<void> {
  if (activeDialect === 'mysql') {
    if (!mysqlPool) throw new Error('MySQL pool has not been initialised');
    await mysqlPool.query('SELECT 1');
    return;
  }

  if (!sqliteInstance) throw new Error('SQLite database has not been initialised');
  sqliteInstance.prepare('SELECT 1').get();
}

export function getDbDiagnostics() {
  return {
    dialect: activeDialect,
    mysqlConfigured: Boolean(mysqlUrl),
    status: 'configured',
  };
}

export async function allocateDocumentSequence(prefix: string, year: number): Promise<number> {
  const timestamp = nowUtc();

  if (activeDialect === 'mysql') {
    if (!mysqlPool) throw new Error('MySQL pool has not been initialised');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO document_sequences (reference_prefix, sequence_year, next_number, updated_at)
         VALUES (?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
        [prefix, year, timestamp],
      );
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT next_number FROM document_sequences
         WHERE reference_prefix = ? AND sequence_year = ? FOR UPDATE`,
        [prefix, year],
      );
      const sequence = rows[0]?.next_number;
      if (typeof sequence !== 'number' || sequence < 1) {
        throw new Error('Document reference sequence could not be allocated.');
      }
      await connection.execute(
        `UPDATE document_sequences SET next_number = next_number + 1, updated_at = ?
         WHERE reference_prefix = ? AND sequence_year = ?`,
        [timestamp, prefix, year],
      );
      await connection.commit();
      return sequence;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  if (!sqliteInstance) throw new Error('SQLite database has not been initialised');
  sqliteInstance.exec('BEGIN IMMEDIATE');
  try {
    sqliteInstance.prepare(
      `INSERT OR IGNORE INTO document_sequences (reference_prefix, sequence_year, next_number, updated_at)
       VALUES (?, ?, 1, ?)`,
    ).run(prefix, year, timestamp);
    const row = sqliteInstance.prepare(
      `SELECT next_number FROM document_sequences
       WHERE reference_prefix = ? AND sequence_year = ?`,
    ).get(prefix, year) as { next_number?: number } | undefined;
    if (typeof row?.next_number !== 'number' || row.next_number < 1) {
      throw new Error('Document reference sequence could not be allocated.');
    }
    sqliteInstance.prepare(
      `UPDATE document_sequences SET next_number = next_number + 1, updated_at = ?
       WHERE reference_prefix = ? AND sequence_year = ?`,
    ).run(timestamp, prefix, year);
    sqliteInstance.exec('COMMIT');
    return row.next_number;
  } catch (error) {
    sqliteInstance.exec('ROLLBACK');
    throw error;
  }
}

export function nowUtc(): any {
  return activeDialect === 'mysql' ? new Date() : new Date().toISOString();
}

export async function closeDb() {
  if (mysqlPool) await mysqlPool.end();
  if (sqliteInstance) sqliteInstance.close();
}
