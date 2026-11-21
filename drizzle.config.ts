import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith('mysql://')) {
  throw new Error('DATABASE_URL must be a MySQL connection URL to generate or apply production migrations.');
}

export default defineConfig({
  schema: './src/db/schema/mysql/index.ts',
  out: './database/migrations',
  dialect: 'mysql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
});
