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
        stmt.run(...cleanParams);
        return { rows: [] };
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

export function nowUtc(): any {
  return activeDialect === 'mysql' ? new Date() : new Date().toISOString();
}

export async function closeDb() {
  if (mysqlPool) await mysqlPool.end();
  if (sqliteInstance) sqliteInstance.close();
}
