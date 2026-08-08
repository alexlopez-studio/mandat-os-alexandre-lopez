# Shadcn Pro System

This project keeps `src/components/ui` as the shadcn-managed foundation.
Project-specific product UI lives in `src/components/pro`.

Layout rules that govern how these components are assembled live in
**`docs/DESIGN.md`** (authoritative, checked by `npm run lint:design`).

## Foundation

- `src/components/ui` : generated or maintained shadcn primitives.
- `src/components/pro` : premium product patterns built on top of shadcn.
- `docs/DESIGN.md` : layout rules, tokens, page anatomy.
- `docs/BRAND.md` : brand tokens and copy rules.
- `docs/DESIGN_UX_GUIDELINES.md` : UX principles.

## Current pro components

Layout :

- `PageLayout` : page wrapper, owns width (`default` / `wide` / `narrow`), padding and
  vertical rhythm. `PageShell` is a deprecated alias.
- `PageSection` : vertical grouping without a heading.
- `Section` / `SectionHeader` : grouping with a heading, description and actions.
- `Grid` : standardised responsive grid (`cols` 2 / 3 / 4).
- `ActionBar` : fixed-order action row for forms and dialogs.

Content :

- `PageHeader` : page heading with optional eyebrow, description and actions.
- `DataToolbar` : title, filters and actions for data-heavy screens.
- `SearchInput` : toolbar search field, owns the icon and its offset.
- `MetricCard` : KPI card for admin dashboards.
- `StatusPill` : compact status badge with product tones.
- `ToggleChip` : interactive pill for multi-select filters.
- `ContactTypePills` : contact typology pills (vendeur, acquereur, partenaire pro, reseau).

States :

- `EmptyState` : useful empty state block.
- `LoadingState` : skeletons shaped like the final content (`table` / `cards` / `text`).
- `ErrorState` : error block with a retry action.

Only components in `src/components/pro` and `src/components/ui` may carry layout CSS.
Anything else — pages included — composes them.

## Workflow

Design system work starts from the local `preview` branch.

Temporary `design/*`, `ux/*`, `ui/*` or `a11y/*` branches are no longer used by default.
Create one only if Alexandre explicitly asks for it or if the risk requires isolating
the change.

## CLI

Use the official shadcn CLI for primitives:

```bash
npx shadcn info
npx shadcn search
npx shadcn docs button card table
npx shadcn add <component>
```

Do not edit shadcn primitives when a project-specific wrapper is enough.
