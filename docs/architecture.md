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

## Dashboard architecture

- `src/pages/admin/AdminDashboard.tsx` owns administrator navigation and dashboard data queries; tab-specific workspaces remain in focused panel modules.
- `src/pages/admin/AdminDashboardTypes.ts` defines the typed API view contract consumed by the administrator dashboard.
- `src/pages/admin/AdminDashboardOverview.tsx` owns the executive overview presentation and receives typed data, loading/error state, retry, and navigation callbacks.
- `src/pages/coordinator/CoordinatorDashboard.tsx` owns coordinator workflows and tab navigation.
- `src/components/dashboard/DashboardMetricCard.tsx` is the shared accessible metric-card primitive used by both dashboards.
- Dashboard cards navigate to existing role-authorized workspaces; authorization remains enforced by the API and is not inferred from presentation state.

Keep dashboard orchestration, data contracts, and presentation separate when adding features. Reuse shared primitives for common interaction patterns, but keep role-specific queues and metrics in their respective dashboard modules.

## Production deployment sequence

1. Provision MySQL 8 and private persistent storage.
2. Configure independent production secrets and TLS termination.
3. Back up the database.
4. Encrypt existing MFA secrets with `npm run db:encrypt-mfa` before deploying the code that decrypts them.
5. Apply reviewed SQL migrations with `npm run db:migrate`.
6. Start the application only after database readiness succeeds.
7. Verify `/api/health/live` and `/api/health/ready`.
8. Keep online payment processing disabled. The organisation completes bank transfers externally; authorised staff record the transfer and supporting bank evidence in the coordinator dashboard, and a separate administrator reviews it before a numbered organisational receipt is issued.

If `MFA_ENCRYPTION_KEY` is lost, restore the original key from a secure backup whenever possible. If it cannot be recovered, an operator can reset one affected user's MFA with `npm run db:reset-mfa -- --user-id <id> --confirm`; this revokes that user's sessions, records an audit event, and requires MFA to be enrolled again after signing in.

## Security invariants

- No demo account or sample data is created during production startup.
- Production requires MySQL and independently generated secrets.
- MFA TOTP secrets are encrypted at rest using AES-256-GCM.
- Public story media requires active narrative and media consent; minor-related stories additionally require guardian consent.
- Private media signatures are bound to the authorised user and ownership is rechecked when serving the file.
- No online payment gateway, card collection, payment webhook or automated refund flow is enabled.
- External bank transfers are recorded against verified beneficiary cases, with bank reference, amount, currency and private evidence attachment.
- Transfer references are unique per bank; a separate administrator must review the evidence before a receipt is issued.
- Receipts are organisational acknowledgements of reviewed evidence, not bank-issued receipts or independent proof of settlement.
- Coordinator API responses do not include internal administrator notes.

## Operational limitations

This branch is a security-hardening foundation, not a certification of production readiness. Transactional email delivery, malware scanning and image re-encoding, backup/restore drills, staging deployment, database integration tests, MFA recovery codes and independent security review remain release gates. The bank-transfer review workflow should also be exercised with real bank-issued evidence in staging before operational use.
