# HumanityBridge

> **Together for a Dignified and Hopeful Tomorrow.**

HumanityBridge is a community-centred humanitarian coordination and social-impact platform. It helps document genuine community needs, protect beneficiary privacy, review cases responsibly and connect people in need with well-wishers who are willing to help.

## Our Origin

HumanityBridge began as a personal gift from **Kuei Poch Kuei**, a fourth-year Computer Science student at **Dilla University**, to **Paul Ruot Bayoch Gtaluak**.

The initiative was conceived in recognition of Paul's dedication to community service. He has devoted considerable time to listening to people, understanding the difficulties they face, identifying those in need and documenting their circumstances so that potential supporters can understand where help is needed.

On **Monday, 16 November 2026, at 2:55 p.m.**, Kuei communicated the initiative to Paul and presented HumanityBridge as a gift intended to help organise, strengthen and facilitate this work.

The platform provides a structured way to register people in need, document their circumstances, organise cases and connect them with well-wishers, individuals and organisations willing to contribute. Its purpose is to support a service-driven vision: **listen to the community, document genuine needs and connect people who need assistance with those willing to provide it.**

*Built through technology. Inspired by service. Connected by humanity.*

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query, React Hook Form, Zod, Recharts and Lucide Icons.
- **Backend**: Node.js 22, Express.js, TypeScript, Argon2id password hashing, HTTP-only cookies, double-submit CSRF protection, Helmet, rate limiting, Multer upload validation and OpenAPI/Swagger.
- **Database**: MySQL 8 with Drizzle ORM and Drizzle Kit. Local development can use the embedded SQLite database.

### Motion and accessibility

The shared motion primitives live in `src/components/motion/MotionPrimitives.tsx` and use the existing Motion package. Use `PageTransition` for route or workspace changes, `MotionReveal` for meaningful content reveals, and `AnimatedNumber` only for real numeric data. Keep movement limited to opacity and small transforms, and ensure new animation behavior respects `prefers-reduced-motion`; lightweight sidebar, drawer, and chart transitions remain CSS/component-level.

## Access Model

1. **Platform Administrator** (/admin): Full governance, sensitive case access, role provisioning, finance, safeguarding, and audit authority.
2. **Operations Administrator** (/admin): Cross-region operational and account administration without confidential beneficiary or finance access.
3. **Regional Coordinator** (/admin): Case assignment, campaigns, and outreach limited to the assigned region; private beneficiary fields are redacted.
4. **Case Verification Officer** (/admin): Case review and confidential evidence access limited to the assigned region.
5. **Story Moderator** (/admin): Story review limited to the assigned region; publication remains a separate permission.
6. **Campaign Manager** (/admin): Campaign workflows and coordinator assignment limited to campaigns associated with the assigned region.
7. **Outreach Officer** (/admin): News and outreach workflows, with volunteer, partnership, and field-report data limited to the assigned region.
8. **Read-Only Auditor** (/admin): Read-only dashboard and audit-trail access.
9. **Community Coordinator** (/coordinator): Registers community needs, records beneficiary information, submits stories and field reports, and records external bank transfers for administrative review.

Administrative API permissions are enforced server-side. Specialist-role provisioning and role assignment are restricted to Platform Administrators; Operations Administrators may provision Community Coordinator accounts. Changing a role revokes the user's active sessions. Region-scoped accounts require a region on their profile, and missing region assignments do not grant global access. Confidential case details and evidence are limited to Platform Administrators and Case Verification Officers in the case's region.

### Story publishing and media

Story authors can create private drafts, submit content for review, attach gallery images with alternative text and captions, and edit content with version snapshots. Publication remains a separate permission and requires active narrative, media, identity, and (where relevant) guardian consent. Unpublishing removes a story from public discovery immediately. Public story endpoints return only published stories with active consent.

Local development uses the existing local media adapter. Production requires `MEDIA_STORAGE_PROVIDER=s3` and an S3-compatible bucket configured with `S3_BUCKET` and `S3_REGION`; set `S3_ENDPOINT` and access-key credentials for Cloudflare R2 or another compatible service. AWS deployments may use workload identity instead of static credentials. Public media remains served through the API, which checks current publication and consent before returning each object. External images are accepted only from exact hostnames in `STORY_IMAGE_ALLOWED_HOSTS`; the application does not fetch remote URLs server-side.

Before deploying the story version/gallery changes, back up MySQL and apply the generated migrations with `npm run db:migrate`. Production startup intentionally fails when durable S3-compatible media storage is not configured.

### Public Impact Centre reporting

The public report is served at `GET /api/v1/public/impact/summary` (the existing `GET /api/v1/impact` URL remains compatible). Both endpoints query the configured database; successful summaries are cached for at most 15 seconds and the cache is invalidated after case verification, campaign status changes, and verified bank-transfer distributions. Query failures are not cached.

Reporting rules:

- Verified public cases require `VERIFIED` status, public publication, beneficiary consent, reviewer and verification timestamp, a matching public `VERIFIED` review record, and guardian consent for child-related cases. Deleted, withdrawn, rejected, and unverified cases are excluded.
- Reported reach is the sum of `affected_count` for eligible cases. It is explicitly not a unique-beneficiary count: the schema has no stable privacy-safe beneficiary key, so unique beneficiaries are unavailable and case totals must not be interpreted as deduplicated people.
- Geographic rows are country-level only and require at least five distinct verified public cases per country. Community names and precise location details are not exposed.
- Active campaigns count non-deleted campaign rows with `ACTIVE` status, matching the public campaign listing. The database has no separate programme or project tables, so programme and completed-project figures are not inferred from campaigns or closed cases.
- Financial totals include confirmed USD donations with confirmation timestamps and USD distributions attached to eligible public cases. Other donation currencies are excluded rather than combined or converted. Trend charts use stored transaction/distribution dates; the selected period filters trends, while headline totals are all-time.
- Public responses contain only aggregates, status, timestamps, and reporting-period metadata. Empty reports return `reportingStatus: EMPTY`; database/query failures return an error and are not represented as a successful empty report.

## External Contributions — No Online Payment Processing

HumanityBridge does **not** provide a payment gateway, process card payments or accept online payments through the platform.

Where a contribution is arranged externally, authorised staff may record the completed bank transfer and submit its supporting bank evidence. An administrator reviews the record before an organisational acknowledgement receipt is issued. The HumanityBridge receipt is not a bank-issued receipt and does not independently prove settlement.

Contributors should independently confirm the organisation's authorised banking details before making any transfer. Do not send funds to an unverified personal account.

## Local Development

Requirements: Node.js 22 and npm.

    npm install
    cp .env.example .env
    npm run dev

The local backend and frontend share http://localhost:3001. The API documentation is at
http://localhost:3001/api-docs.

Port 3001 and Vite HMR WebSocket port 26000 can be changed in `.env` with `PORT` and
`VITE_HMR_PORT`. Do not set these development values in production deployments.

For local database setup, use the repository's documented SQLite development configuration. For production, configure MySQL 8 and apply the database migrations:

    npm run db:migrate

## Automated Tests

Run the acceptance and security regression suites:

    npm test
    npm run test:security
    npm run lint
    npm run build

## Security and Safeguarding Principles

- Passwords are hashed using Argon2id.
- Authenticated sessions use HTTP-only cookies; authentication tokens are not stored in browser local storage.
- Authenticated mutations use server-side CSRF validation.
- Multi-factor authentication is supported for privileged access.
- Public case summaries are separated from private beneficiary contact records and sensitive evidence.
- Case publication requires appropriate consent and administrative review.
- External bank-transfer evidence is private and subject to role-based access and administrative review.
- Audit records support accountability for sensitive administrative actions.

## Project Status

HumanityBridge is an evolving software platform. A successful build or automated test run does not, by itself, constitute a security certification or confirmation that the organisation is legally registered. Production deployment should follow staging validation, operational readiness checks and an independent security review.
