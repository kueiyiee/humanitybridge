import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/mysql/index.ts',
  out: './database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://humanitybridge:change_me_db_password@127.0.0.1:3306/humanitybridge',
  },
  verbose: true,
  strict: true,
});
