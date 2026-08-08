# Codex instructions

Ce repo est l'application autonome Mandat OS.

Codex est prioritaire sur le design produit, l'UX, l'interface, le responsive,
l'accessibilite et la coherence visuelle de l'application.

Avant de modifier l'interface, lire :

- `docs/DESIGN_UX_GUIDELINES.md`
- `docs/BRAND.md`
- **Design System** : Se référer systématiquement à `src/app/admin/market/design-system/page.tsx` comme source de vérité (Single Source of Truth) pour garantir la cohérence et l'harmonie de l'interface (composants, boutons, couleurs, tailles). Ne jamais inventer de nouveaux composants d'interface sans vérifier s'ils existent déjà dans ce guide.

Branche de travail :

- travailler localement sur `preview` par defaut ;
- ne rien pousser sans demande explicite d'Alexandre ;
- quand Alexandre demande explicitement une livraison, integrer `preview` vers `main` puis pousser `origin/main` ;
- ne pas creer de branches `design/*`, `ux/*`, `ui/*`, `a11y/*`, `feat/*` ou `fix/*` sauf decision explicite.

Les changements doivent rester centres sur Mandat OS sauf demande explicite.
