# Codex instructions

Ce repo est l'application autonome Mandat OS.

Codex est prioritaire sur le design produit, l'UX, l'interface, le responsive,
l'accessibilite et la coherence visuelle de l'application.

Avant de modifier l'interface, lire :

- **`docs/DESIGN.md`** — regles de mise en page et de coherence visuelle. Fait autorite.
  Toute page ou composant qui le contredit est un bug.
- `docs/BRAND.md` — couleurs, typographie, ton. Autoritaire en cas de conflit avec `DESIGN.md`.
- `docs/DESIGN_UX_GUIDELINES.md` — principes UX produit.

Regles non negociables (detail dans `docs/DESIGN.md`) :

- une page = `<PageLayout>` + primitives de `@/components/pro`. Pas de layout improvise
  dans un `page.tsx` ;
- un besoin non couvert par une primitive → **ajouter une primitive** dans
  `src/components/pro/`, jamais un `<div className="…">` dans la page ;
- zero couleur brute (`bg-white`, `text-gray-500`), zero valeur arbitraire (`text-[15px]`),
  espacements dans l'echelle `2 / 4 / 6 / 8` ;
- pages de reference : `src/app/admin/market/contacts/page.tsx` et
  `src/app/admin/market/opportunities/OpportunitiesWorkspace.tsx`.

Avant de conclure une tache qui touche l'interface :

```bash
npm run lint:design:changed
```

Toute page nouvelle ou reecrite doit sortir a zero violation. Les pages anciennes
portent encore de la dette, non bloquante.

Branche de travail :

- travailler localement sur `preview` par defaut ;
- ne rien pousser sans demande explicite d'Alexandre ;
- quand Alexandre demande explicitement une livraison, integrer `preview` vers `main` puis pousser `origin/main` ;
- ne pas creer de branches `design/*`, `ux/*`, `ui/*`, `a11y/*`, `feat/*` ou `fix/*` sauf decision explicite.

Les changements doivent rester centres sur Mandat OS sauf demande explicite.
