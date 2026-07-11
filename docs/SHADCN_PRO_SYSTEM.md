# Shadcn Pro System

This project keeps `src/components/ui` as the shadcn-managed foundation.
Project-specific product UI lives in `src/components/pro`.

## Foundation

- `src/components/ui` : generated or maintained shadcn primitives.
- `src/components/pro` : premium product patterns built on top of shadcn.
- `docs/BRAND.md` : brand tokens and copy rules.
- `docs/DESIGN_UX_GUIDELINES.md` : UX rules for Codex work.

## Current pro components

- `PageShell` : consistent page spacing for app screens.
- `PageSection` : simple vertical grouping for page content.
- `PageHeader` : premium page heading with optional eyebrow and actions.
- `MetricCard` : KPI card for admin dashboards.
- `StatusPill` : compact status badge with product tones.
- `EmptyState` : useful empty/error state block.
- `DataToolbar` : title, filters and actions for data-heavy screens.

## Workflow

Design system work starts from the local `preview` branch.

Temporary `design/*`, `ux/*`, `ui/*` or `a11y/*` branches are no longer used by default. Create one only if Alexandre explicitly asks for it or if the risk requires isolating the change.

## CLI

Use the official shadcn CLI for primitives:

```bash
npx shadcn info
npx shadcn search
npx shadcn docs button card table
npx shadcn add <component>
```

Do not edit shadcn primitives when a project-specific wrapper is enough.
