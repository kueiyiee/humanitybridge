# Backend Architecture

The HTTP API and server-side domain logic are implemented under src/server/; server.ts is the process entry point. This directory documents backend ownership and is not a duplicate implementation.

## Source map

- server.ts: environment validation, database readiness, Vite/static hosting and process startup.
- src/server/app.ts: Express middleware, health endpoints and route registration.
- src/server/routes/: HTTP adapters for identity, public content, coordinator, administrator, donations, documents and media.
- src/server/middleware/: authentication, CSRF and error handling.
- src/server/services/: audit, document generation, impact reporting, media storage, payments and translation.
- src/server/config/: environment, logging and OpenAPI configuration.
- src/server/utils/: cryptographic and file-validation utilities.

## Service boundaries

- Route handlers validate request data, establish identity and apply policy.
- Domain services own business rules and state transitions.
- Database access is server-only and uses the selected Drizzle dialect.
- Public serializers explicitly select fields safe for public disclosure.
- Media access rechecks publication, consent, ownership and authorisation at request time.
- Sensitive actions produce audit events without recording credentials, session tokens, MFA secrets or unnecessary beneficiary details.

## Security rules

1. Enforce role and region permissions on every protected API operation.
2. Never rely on frontend visibility as an authorisation control.
3. Keep private evidence outside the public static directory.
4. Validate uploaded file size, declared type, extension and actual signature.
5. Use endpoint-specific abuse controls for sensitive public submissions.
6. Avoid logging request bodies containing personal or confidential data.
7. Fail closed when production secrets, MySQL or required durable media storage are missing.
8. Keep online payment processing disabled unless a separately reviewed payment integration is approved.

## Refactoring approach

Keep the modular monolith. Decompose large route files incrementally by domain and move business logic into services only when behaviour can be covered by route-level and service-level tests. Avoid a mass directory move or microservice split without measured justification.
