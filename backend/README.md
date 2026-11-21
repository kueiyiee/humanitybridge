# Backend architecture

The HTTP API and server-side domain logic are currently implemented under `src/server/`, with `server.ts` as the process entry point.

## Source ownership

- `server.ts`: process bootstrap, environment validation, database readiness and Vite/static hosting.
- `src/server/app.ts`: Express middleware, health endpoints and API route registration.
- `src/server/routes/`: HTTP controllers for authentication, public content, coordinator, administrator, donations and media.
- `src/server/middleware/`: authentication, CSRF and error handling.
- `src/server/services/`: payment adapter, audit and translation services.
- `src/server/config/`: environment, logging and OpenAPI configuration.
- `src/server/utils/`: cryptographic and domain utilities.

## Boundary rules

1. Route handlers validate input, enforce authorisation and delegate domain operations to services.
2. The backend is the sole authority for roles, permissions, consent and financial state transitions.
3. Private media is stored outside the static web root and served only after per-request authorisation.
4. Production startup fails closed when required secrets, MySQL or an implemented payment provider are missing.
5. Sensitive actions must write audit events without logging secrets, tokens or beneficiary personal data.

## Migration note

Existing route imports are retained in this change to preserve compatibility. Moving the implementation physically into `backend/src` requires a coordinated import-path and build-system migration with a working local test environment.
