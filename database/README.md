# Database architecture

The database layer is implemented under `src/db/`; migration history and seed tooling live under this directory.

## Source ownership

- `src/db/index.ts`: database connection lifecycle, dialect selection and readiness.
- `src/db/schema/mysql/`: production MySQL 8 Drizzle schema.
- `src/db/schema/sqlite/`: local-development and test SQLite schema.
- `src/db/bootstrapSqlite.ts`: SQLite schema bootstrap.
- `database/migrations/`: versioned MySQL migration history.
- `database/seeds/`: development-only demonstration data.

## Operational rules

1. MySQL 8 is the production database. SQLite is for local development and tests.
2. Apply reviewed migrations with `npm run db:migrate`; do not use schema push in production.
3. Back up the database before migrations and before the one-time MFA-secret encryption operation.
4. Never commit database files, WAL files, private storage, credentials or production exports.
5. Keep MySQL and SQLite logical schemas aligned and run the acceptance suite against both.
6. Do not expose beneficiary personal information in public reporting tables or API responses.

## Existing database migration

Before deploying the encrypted-MFA-secret code, set `MFA_ENCRYPTION_KEY`, back up the database, and run `npm run db:encrypt-mfa` once against the target database. Verify that all MFA records use the versioned `v1:` envelope before starting the new application version.
