# Frontend Architecture

The browser application is implemented under src/ and served by Vite. This directory documents frontend ownership; it is not a second source tree.

## Source map

- src/main.tsx and src/App.tsx: application entry point and route composition.
- src/pages/public/: public information, stories, cases, campaigns, participation and CMS pages.
- src/pages/admin/: administrator dashboard and domain workspaces.
- src/pages/coordinator/: field and community coordination workspace.
- src/components/: shared UI components and accessible primitives.
- src/layouts/: public and authenticated workspace shells.
- src/contexts/: authentication, locale and theme state.
- src/services/api.ts: browser-to-API client.
- src/styles/ and src/index.css: design tokens and component styles.

## Engineering rules

1. Browser code communicates with the server through src/services/api.ts.
2. Never connect the browser directly to MySQL or SQLite.
3. Treat client-side route guards and hidden controls as usability features, not access control.
4. Every screen must handle loading, error, empty and success states.
5. Use semantic headings, landmarks, labels, keyboard-accessible controls and visible focus indicators.
6. Respect prefers-reduced-motion; animation must not be required to understand status or data.
7. Avoid fake metrics, hard-coded public records and success messages unsupported by API responses.
8. Keep public pages free of private beneficiary fields, internal notes and unconsented media.
9. Use the shared graphite/silver theme with restrained cyan accents; do not introduce unrelated brand palettes in new screens.

## UI quality checklist

- Responsive from 320px mobile widths through large desktop screens.
- Navigation remains usable by keyboard and touch.
- Tables have a narrow-screen strategy and do not force page-wide overflow.
- Form fields have persistent labels, helpful validation and clear error feedback.
- Empty states explain what is absent and, where permitted, what action can create the first record.
- Destructive actions require confirmation and explain their impact.
- Data visualisations include labels, units and meaningful empty states.
- Colour is never the only way to communicate state.
