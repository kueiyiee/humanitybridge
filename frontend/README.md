# Frontend architecture

The browser application is currently implemented under `src/` and is served by Vite.

## Source ownership

- `src/main.tsx`, `src/App.tsx`: application entry point and route composition.
- `src/pages/public/`: public humanitarian information, campaigns, stories and participation.
- `src/pages/admin/`: administrator workspace.
- `src/pages/coordinator/`: coordinator workspace.
- `src/components/`: shared UI components.
- `src/layouts/`: public and dashboard layouts.
- `src/contexts/`: authentication, locale and theme state.
- `src/services/api.ts`: browser-to-API client.
- `src/assets/` and `public/`: static assets.

## Boundary rules

1. Browser code must call the API through `src/services/api.ts`; it must not connect directly to MySQL or SQLite.
2. Authentication and role decisions are enforced by the backend. Protected routes in React are a usability layer, not an authorisation boundary.
3. Public pages must never render internal case notes, beneficiary contact details, private documents or unconsented media.
4. API errors, empty states, loading states and session expiry should be handled consistently.
5. Keep shared request/response contracts in `packages/shared/` until a separately versioned contracts package is introduced.

## Migration note

The current Vite entry point and import graph are retained in this hardening change to avoid a risky mass file move without a local build environment. The logical frontend boundary is documented here; a physical move to `frontend/src` should be performed as a dedicated, tested refactor.
