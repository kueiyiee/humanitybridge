# HumanityBridge Architecture

HumanityBridge is a humanitarian coordination, safeguarding and financial-accountability platform. The system separates public information from authenticated operational workflows and private beneficiary records.

## Logical architecture

```text
Browser clients
  └── React 19 + TypeScript + Vite
       ├── Public information and campaigns
       ├── Administrator workspace
       └── Community coordinator workspace
              │ HTTPS / JSON API
              ▼
Node.js 22 + Express API
  ├── Authentication, sessions, CSRF and RBAC
  ├── Public content and consent policy
  ├── Case and coordinator workflows
  ├── Safeguarding and media access
  ├── Donations, payment verification and financial ledger
  └── Audit, notification and translation services
              │ Drizzle ORM
              ▼
Database and storage
  ├── MySQL 8 (production)
  ├── SQLite (local development / tests)
  ├── Private file storage (outside static web root)
  └── Public media storage (consent-gated delivery)
```

## Repository boundaries

- `src/`: current Vite application source and shared source tree.
- `src/server/`: Express API, middleware, routes, services and configuration.
- `src/db/`: Drizzle schemas, database connection and SQLite bootstrap.
- `packages/shared/`: shared types and validation contracts.
- `database/migrations/`: versioned MySQL migrations.
- `database/seeds/`: development-only sample data.
- `frontend/`: frontend ownership and boundary documentation.
- `backend/`: backend ownership and boundary documentation.
- `database/`: database operations, migrations and seed ownership.

The top-level frontend and backend documentation folders establish clear domain ownership. Existing source paths are intentionally retained for this hardening branch so that imports and Vite/TypeScript resolution are not broken by an unverified mass move. A physical move into `frontend/src` and `backend/src` should be a separate refactor with a full build and integration-test run.

## Production deployment sequence

1. Provision MySQL 8 and private persistent storage.
2. Configure independent production secrets and TLS termination.
3. Back up the database.
4. Encrypt existing MFA secrets with `npm run db:encrypt-mfa` before deploying the code that decrypts them.
5. Apply reviewed SQL migrations with `npm run db:migrate`.
6. Start the application only after database readiness succeeds.
7. Verify `/api/health/live` and `/api/health/ready`.
8. Enable live payment processing only after a provider-specific adapter, webhook signature scheme, settlement reconciliation and refund API have been implemented and tested.

## Security invariants

- No demo account or sample data is created during production startup.
- Production requires MySQL and independently generated secrets.
- MFA TOTP secrets are encrypted at rest using AES-256-GCM.
- Public story media requires active narrative and media consent; minor-related stories additionally require guardian consent.
- Private media signatures are bound to the authorised user and ownership is rechecked when serving the file.
- A payment webhook must be signed over its original request bytes and match the original donation amount and currency.
- The sandbox payment adapter is development-only. The current repository has no live provider implementation; production payment operations remain disabled.
- Refunds cannot be represented as completed until a real provider refund operation is available.
- Coordinator API responses do not include internal administrator notes.

## Operational limitations

This branch is a security-hardening foundation, not a certification of production readiness. A real payment gateway, SMTP delivery provider, malware scanning, backup/restore drills, CI execution, database integration tests and deployment-environment verification remain release gates.
