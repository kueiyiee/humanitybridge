# HumanityBridge UI and security review

**Review date:** 21 November 2026  
**Scope:** Public website, administrator/coordinator shell, theme rendering, authentication controls, and media-upload handling.

## Changes in this update

- Replaced the static decorative particle SVG with a lightweight canvas network. It caps the particle count and device-pixel ratio, limits redraw frequency, pauses while the tab is hidden, and honours `prefers-reduced-motion`.
- Mounted the same ambient background behind public pages and both role-based workspaces. Content, navigation, and the mobile dock remain above the decorative layer.
- Added a single graphite/black/silver visual token layer with restrained cyan accents for light and dark themes, glass surfaces, navigation, forms, dashboard panels, and the public footer.
- Reduced account-enumeration and denial-of-service risk in sign-in handling by querying only the matching account and removing the global five-failure account lockout. Added stricter per-IP sign-in and MFA action rate limits.
- Strengthened upload validation: MIME type must match the extension, and JPEG, PNG, WebP, and PDF signatures are checked more strictly.
- Made file writes asynchronous and exclusive, applied restrictive permissions to private evidence, cleaned up files if metadata persistence fails, and added no-store/nosniff response headers. Private evidence is returned as an attachment.
- Added regression tests for file-signature validation.

## Production risks that remain

1. **Persistent media storage:** the current media route writes to the local filesystem. Vercel serverless filesystems are not durable storage. Private case evidence and public media need a persistent object-storage adapter with separate public/private buckets or access policies before production uploads can be relied upon.
2. **Distributed rate limiting:** the current Express rate-limiters use their default in-memory store. A multi-instance or serverless production deployment needs a shared rate-limit store to enforce limits consistently.
3. **Vercel API deployment:** this repository currently builds the Vite frontend with `vite build`; the Express API is started by `server.ts`. No Vercel serverless API entry point or API rewrite is present in this repository. A static Vercel deployment alone does not host the Express API routes used by `/api/v1`.
4. **Production configuration:** the API requires MySQL and independently generated production secrets. Those values must be configured in the hosting environment; they must never be committed to Git.
5. **Password-reset delivery:** the API currently creates reset tokens but does not have a production email-delivery integration configured.

These operational items cannot be truthfully marked fixed without the storage provider, hosting configuration, and production credentials. The code changes above improve the current implementation but are not a substitute for a deployment-specific security assessment or penetration test.
