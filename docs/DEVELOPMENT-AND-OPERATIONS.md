# Development and Operations Guide

## Supported local setup

- Node.js 22.13 or newer
- npm 10 or newer
- Git
- Windows, macOS or Linux

The default local database is SQLite. MySQL is not required to run the development application or SQLite schema checks.

## First-time setup

Install dependencies:

```bash
npm install
```

Copy .env.example to .env and keep these local settings:

```dotenv
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3001
USE_MYSQL=false
DATABASE_URL=
SQLITE_DB_PATH=./data/humanitybridge.db
MEDIA_STORAGE_PROVIDER=local
COOKIE_SECURE=false
PAYMENT_PROVIDER=disabled
```

Set a private owner password in OWNER_ADMIN_INITIAL_PASSWORD. Do not commit .env or share the password.

Start the application:

```bash
npm run dev
```

The application creates the SQLite database and its initial schema automatically. Open:

- Web application: http://localhost:3001
- API health: http://localhost:3001/api/health/ready
- API documentation: http://localhost:3001/api-docs

In a second terminal, configure the initial owner administrator:

```bash
npm run owner:configure
```

The setup script preserves an existing account's password and history if the owner account already exists. It does not create synthetic public cases or sample stories. Do not run the optional synthetic seed on a live or public deployment.

## SQLite operations

```bash
npm run db:sqlite:check
npm run test:sqlite
```

The integrity check verifies SQLite page integrity, foreign-key consistency and required core tables. It does not replace a backup.

The local database is stored at ./data/humanitybridge.db by default. The path can be changed with SQLITE_DB_PATH. The database and its -wal / -shm companions are ignored by Git.

To preserve data, stop the application and copy the database using SQLite's backup API or a controlled backup procedure. Do not delete the data directory as a troubleshooting shortcut.

## Test and build commands

```bash
npm run lint
npm run test:sqlite
npm run test:security
npm test
npm run build
```

The acceptance suite uses isolated synthetic records. These records exist for automated testing only and must not be interpreted as real humanitarian activity.

## Database dialect boundary

SQLite is the local development and test dialect. src/db/bootstrapSqlite.ts owns local schema creation. drizzle.config.ts and database/migrations/ currently target MySQL 8 only.

Do not run npm run db:migrate or npm run db:generate with a SQLite URL. Those commands are for reviewed MySQL migration work.

Production startup continues to require MySQL 8, HTTPS, secure cookies, strong independent secrets and S3-compatible durable media storage. Switching to MySQL later is a deliberate deployment operation, not a change to make by editing the local .env file.

## Initial administrator safety

- Use a unique password of at least 16 characters.
- Keep OWNER_ADMIN_INITIAL_PASSWORD only in the local .env.
- Do not use synthetic seed account credentials in any environment.
- Enrol MFA for privileged accounts before handling real beneficiary records.
- Create named staff accounts through the authorised administration workflow.

## Content publishing verification

For each content type, verify the full lifecycle with a non-sensitive test record:

1. Create a draft in the authorised workspace.
2. Save and reload it to confirm database persistence.
3. Preview the draft using the permitted preview route.
4. Publish it and verify the public listing and detail page.
5. Edit the published record and confirm the public content updates.
6. Unpublish or archive it and confirm it is no longer publicly discoverable.
7. Check that private editorial notes and internal identifiers are absent from public API responses.

For stories, separately verify consent records, guardian requirements where relevant, media alternative text and withdrawal/unpublication behaviour. Never use identifiable real people or beneficiary information for UI testing without valid authority and documented consent.

## Production handover checklist

- [ ] Confirm the legal organisation and authorised signatories before presenting institutional claims as facts.
- [ ] Provision MySQL 8 and durable S3-compatible media storage.
- [ ] Generate and store independent production secrets in the hosting secret manager.
- [ ] Back up and test restoration before migration.
- [ ] Review and apply MySQL migrations in staging first.
- [ ] Configure HTTPS, trusted proxy topology, cookies and rate-limit strategy.
- [ ] Configure transactional email and test password recovery.
- [ ] Verify scheduled publishing, media access and public consent rules.
- [ ] Run role/region access tests and end-to-end acceptance checks.
- [ ] Conduct an independent security and safeguarding review.
- [ ] Obtain operational approval before importing real beneficiary information.
