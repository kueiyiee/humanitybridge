# HumanityBridge — System Architecture

**Document status:** Current repository architecture  
**Architecture style:** Modular monolith  
**Primary concern:** Safe coordination of humanitarian operations, consent-led public information, safeguarding and financial accountability.

## 1. System context

HumanityBridge separates three trust zones:

1. **Public experience** — published information, approved stories, public case summaries, campaigns, institutional content and public document verification.
2. **Authenticated operational workspaces** — administrators, specialist reviewers and community coordinators operating within server-enforced permissions.
3. **Restricted records and evidence** — beneficiary contact information, safeguarding reports, private case documents, financial evidence and audit data.

```
Public visitors ─┐
Administrators ──┼── React + TypeScript web application
Coordinators ────┘                 │
                                   │ HTTPS / JSON
                                   ▼
                         Express + TypeScript API
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       Identity and RBAC     Domain workflows     Public content
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
                            Drizzle ORM
                                   │
                       SQLite (local/test)
                         MySQL (production)
                                   │
                         Media storage layer
```

## 2. Technology and runtime

| Layer | Current implementation | Responsibility |
|---|---|---|
| Web client | React 19, TypeScript, Vite, React Router | Public pages and role-based workspaces |
| UI state | TanStack Query, React Hook Form, Zod | Server state, forms and client-side validation |
| API | Node.js 22+, Express, TypeScript | Authentication, domain workflows and API contracts |
| Data access | Drizzle ORM | Typed queries against the selected SQL dialect |
| Local database | SQLite via Node node:sqlite and Drizzle SQLite proxy | Local development and automated tests |
| Production database | MySQL 8 via mysql2 and Drizzle MySQL | Production persistence |
| Media | Local adapter for development; S3-compatible adapter for production | Public media and restricted evidence |
| Tests | Node test runner, tsx, TypeScript and Vite build | Regression, acceptance, type and build verification |

The browser communicates with the backend through the shared API client. Browser code must never connect directly to SQLite or MySQL.

## 3. Repository map and source-of-truth boundaries

The current import graph intentionally keeps application implementation under src/. The top-level frontend/ and backend/ directories are ownership and onboarding documentation boundaries, not duplicate application source trees.

```
src/
  App.tsx                    Route composition
  main.tsx                   Browser entry point
  assets/                    Bundled visual assets
  components/                Shared accessible UI primitives
  contexts/                  Authentication, locale and theme state
  layouts/                   Public and dashboard shells
  pages/
    public/                  Public pages and CMS rendering
    admin/                   Administrator workspaces and panels
    coordinator/             Community coordinator workspace
  services/api.ts            Browser API client
  db/
    index.ts                 Database dialect selection and lifecycle
    bootstrapSqlite.ts       Idempotent SQLite schema bootstrap
    schema/sqlite/           SQLite Drizzle schema
    schema/mysql/            MySQL Drizzle schema
  server/
    app.ts                   Express middleware and route composition
    config/                  Environment, logging and OpenAPI
    middleware/              Authentication, CSRF and error handling
    routes/                  HTTP route adapters
    services/                Domain and infrastructure services
    utils/                   Security and file utilities
packages/shared/             Shared roles, types and validation contracts
database/migrations/         Versioned MySQL migration history
database/seeds/              Synthetic development/test seed only
scripts/                     Explicit operator and database utilities
tests/                       Acceptance and security regression tests
docs/                        Architecture, UX, security and operations records
```

**Do not create a second frontend/src or backend/src implementation.** A physical source-tree migration requires coordinated path aliases, Vite configuration, TypeScript project references, test imports and deployment changes. It should be a separate refactor with a verified build.

## 4. Backend module boundaries

The application is a modular monolith. Keep one deployable API process while enforcing domain ownership:

- **Identity and access:** users, profiles, sessions, MFA, password recovery, role and permission policy.
- **Humanitarian operations:** cases, requirements, assignments, verification and assistance records.
- **Storytelling:** story drafts, media, consent, moderation, version history and publication.
- **Campaigns and finance:** campaigns, external contribution records, transfer review and reconciliations.
- **Content management:** announcements, publications, events, vacancies, projects and other generic editorial content.
- **Documents:** templates, approvals, issuance, immutable document snapshots and public verification.
- **Safeguarding and privacy:** restricted reports, consent records and privacy requests.
- **Platform operations:** notifications, audit trail, reporting, media and system settings.

Routes should remain HTTP adapters: parse and validate input, authenticate the request, apply policy and delegate business transitions to domain services. Avoid moving business logic into React or using dashboard visibility as an authorisation control.

## 5. Database policy

### Local development and tests

SQLite is the default when USE_MYSQL is not true and DATABASE_URL is not a MySQL URL. The application creates data/humanitybridge.db and bootstraps its tables through ensureSqliteSchema().

- SQLite bootstrap is idempotent and owns local schema creation.
- src/db/schema/sqlite/ provides the Drizzle table descriptors used by application queries.
- MySQL migration files are not SQLite migrations; do not run drizzle-kit migrate against SQLite.
- Keep both dialect schemas logically aligned and add regression tests whenever a table or column changes.
- The SQLite file and its WAL files are local state and must remain untracked.

### Production

Production remains MySQL 8. The startup validator intentionally rejects SQLite in production. Before switching environments, back up data, review dialect-specific migrations, migrate records, verify foreign keys and counts, and test restore procedures.

## 6. Content publication lifecycle

Generic CMS content and specialist records have separate lifecycles.

- CMS content is stored in cms_content; its type maps to a defined public section and route.
- Stories use dedicated story, media, consent and moderation records. A story must satisfy publication and consent policy before it is returned publicly.
- Campaigns use dedicated campaign and publication records.
- Public routes must return only published, non-deleted and non-expired records. Public responses must not expose internal editorial notes, private evidence or beneficiary identifiers.
- Unpublishing or withdrawing consent must remove the content from public discovery without relying on client-side hiding.

Do not merge distinct domain models merely to make the dashboard appear simpler.

## 7. Dashboard composition

AdminDashboard.tsx coordinates role-aware navigation and server queries. AdminDashboardOverview.tsx renders the executive overview. Domain panels remain in focused files under src/pages/admin/.

The UI may hide actions the current role cannot use, but every API mutation and read must still enforce server-side permissions and region scope. Metrics and charts must be derived from API/database responses; never fabricate values to fill empty dashboard states.

## 8. Security invariants

- Argon2id password hashing; HTTP-only session cookies; server-side session validation.
- CSRF validation on authenticated mutations.
- Server-side RBAC and region scoping; client route guards are not a security boundary.
- Private evidence remains outside the static public web root and is served only after authorisation.
- Public story content and media require current consent and publication eligibility.
- Beneficiary contact data, safeguarding reports and internal notes are not public.
- Financial records are not presented as settled unless the relevant review state supports that claim.
- Audit events must not contain passwords, tokens, MFA secrets or unnecessary beneficiary details.
- Online payment processing remains disabled; bank-transfer records represent externally completed transfers subject to review.

## 9. Architecture evolution

Keep the modular monolith until there is measured evidence that a domain needs independent deployment or scaling. Prioritise route decomposition, service boundaries, consistent validation, database parity, observable workflows and test coverage before introducing microservices.

## 10. Release gates

1. SQLite schema smoke test and acceptance tests pass.
2. Type-check and production frontend build pass.
3. Security regression tests pass.
4. Database migration has been reviewed and backed up.
5. Public publishing and unpublishing have been checked end-to-end.
6. Role/region access tests cover both allowed and denied cases.
7. Media storage, email delivery, backups and hosting topology are verified for the target environment.
8. Staging smoke tests and independent security review are complete.

A passing CI run is evidence of those automated checks only; it is not a security certification or proof that every production integration is configured.
