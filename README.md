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

## Access Model

1. **Platform Administrator** (/admin): Reviews cases and beneficiary records, manages coordinators, moderates stories, reviews external bank-transfer evidence, oversees safeguarding and accesses audit records.
2. **Community Coordinator** (/coordinator): Registers community needs, records beneficiary information, submits stories and field reports, and records external bank transfers for administrative review.

## External Contributions — No Online Payment Processing

HumanityBridge does **not** provide a payment gateway, process card payments or accept online payments through the platform.

Where a contribution is arranged externally, authorised staff may record the completed bank transfer and submit its supporting bank evidence. An administrator reviews the record before an organisational acknowledgement receipt is issued. The HumanityBridge receipt is not a bank-issued receipt and does not independently prove settlement.

Contributors should independently confirm the organisation's authorised banking details before making any transfer. Do not send funds to an unverified personal account.

## Local Development

Requirements: Node.js 22 and npm.

    npm install
    cp .env.example .env
    npm run dev

Visit http://localhost:3000 for the platform and http://localhost:3000/api-docs for the API documentation.

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
