# Database Architecture and Operations

The database implementation lives under src/db/. This directory contains versioned MySQL migration history and database operations documentation.

## Source of truth

- src/db/index.ts: dialect selection, connection lifecycle, diagnostics and document sequence allocation.
- src/db/schema/sqlite/: SQLite Drizzle descriptors for local development and tests.
- src/db/schema/mysql/: MySQL Drizzle descriptors for production.
- src/db/bootstrapSqlite.ts: idempotent SQLite schema bootstrap and additive compatibility changes.
- database/migrations/: MySQL 8 migration history only.
- database/seeds/: synthetic development and acceptance-test fixtures only.

## Local SQLite

Set USE_MYSQL=false, leave DATABASE_URL empty and optionally set SQLITE_DB_PATH. The application creates the database and bootstraps tables automatically.

Run:

```bash
npm run db:sqlite:check
npm run test:sqlite
```

Do not run Drizzle Kit's MySQL migration commands against SQLite.

## MySQL production

Set USE_MYSQL=true and a valid MySQL DATABASE_URL. Back up the target database, review migration SQL, apply migrations in staging, validate data and constraints, then schedule production migration and rollback procedures.

## Schema parity

When adding or changing a persisted field:

1. Update both dialect-specific Drizzle schemas.
2. Update SQLite bootstrap creation or additive migration logic.
3. Add/update the MySQL migration and journal/snapshot as required.
4. Add tests for required columns, constraints and query behaviour in both supported dialects.
5. Never silently drop or rename a field that may contain user or beneficiary data.

SQLite and MySQL share logical table/property names but use dialect-specific types and migration mechanisms.

## Data protection

- Never commit .env, database files, WAL/SHM files, backups or production exports.
- Keep beneficiary and safeguarding data restricted to authorised roles.
- Do not seed synthetic records into a public or production database.
- Test backup restoration, not only backup creation.
