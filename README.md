# HumanityBridge

> **Together for a Dignified and Hopeful Tomorrow.**

HumanityBridge is a full-stack humanitarian storytelling, community assistance, and social-impact platform engineered to connect vulnerable communities with verified relief while preserving human dignity, privacy, safeguarding, and financial transparency.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide Icons, QRCode.
- **Backend**: Node.js 22, Express.js, TypeScript, Argon2id (`@noble/hashes`), HTTP-only cookies, double-submit CSRF, Helmet, Rate Limiting, Multer upload validation, OpenAPI/Swagger (`/api-docs`).
- **Database**: MySQL 8 + Drizzle ORM + Drizzle Kit (`src/db/schema/mysql/*`, migrations in `database/migrations/`), with an automatic embedded relational SQLite mirror (`node:sqlite` + Drizzle proxy) when `USE_MYSQL` is not enabled in local sandbox mode.

## Two-Role Access Model

1. **`PLATFORM_ADMIN`** (`/admin`): Full executive overview, user & coordinator management, case verification, story moderation, campaign management, donation reconciliation & refunds, safeguarding centre, system settings, MFA, and audit logs.
2. **`COMMUNITY_COORDINATOR`** (`/coordinator`): Focused field workspace for case registration (with private contact vault & drafts), story submission (unpublished until approved), assistance requests, field reports, submission tracking, and notifications.

## Prerequisites & Local Startup

```bash
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

Visit `http://localhost:3000` for the web platform and `http://localhost:3000/api-docs` for Swagger API documentation.

## Production MySQL 8 + Docker Compose

1. Configure `.env` with strong secrets (`SESSION_SECRET`, `CSRF_SECRET`, `SIGNED_URL_SECRET`, `PAYMENT_WEBHOOK_SECRET`) and MySQL credentials.
2. Start MySQL 8 and HumanityBridge:
   ```bash
   docker compose up -d --build
   ```
3. Push schema / apply migrations and bootstrap the first administrator securely via environment variables:
   ```bash
   USE_MYSQL=true npm run db:push
   ADMIN_BOOTSTRAP_EMAIL="director@yourdomain.org" ADMIN_BOOTSTRAP_PASSWORD="StrongPassword#2026" USE_MYSQL=true npm run db:seed
   ```

## Automated Security & Acceptance Tests

Run the acceptance suite covering all 10 mandatory security and workflow invariants:

```bash
npm test
```

## Security Highlights

- Passwords hashed with RFC 9106 **Argon2id**.
- Sessions stored in `user_sessions` via hashed tokens inside **HTTP-only** cookies (no `localStorage` auth tokens).
- Double-submit HMAC **CSRF** protection on authenticated mutations.
- **RFC 6238 TOTP MFA** supported for Platform Administrators.
- Strict separation between public case summaries and private beneficiary contact records.
- Idempotent, HMAC-SHA256-verified payment webhook processing (`payment_webhook_events` + `payment_transactions` unique provider references).
