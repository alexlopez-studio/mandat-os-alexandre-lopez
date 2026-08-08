# Role Claude Code

Ce repo est l'application autonome Mandat OS.

Claude Code est prioritaire sur les fonctionnalites, la logique metier, les APIs,
Supabase, les migrations, les integrations et les corrections techniques.

Flux attendu :

- travailler localement sur `preview` par defaut ;
- ne rien pousser sans demande explicite d'Alexandre ;
- quand Alexandre demande explicitement une livraison, integrer `preview` vers `main` puis pousser `origin/main` ;
- ne pas creer de branches `feat/*`, `fix/*`, `hotfix/*`, `chore/*` ou `docs/*` sauf decision explicite d'Alexandre ;
- laisser les sujets design/UX purs a Codex quand ils ne sont pas necessaires a la fonctionnalite.

## Design

`docs/DESIGN.md` fait autorite sur la mise en page. A lire avant de toucher a une page
ou a un composant, meme pour une modification purement fonctionnelle qui produit du JSX.

En resume :

- une page = `<PageLayout width="default|wide|narrow">` + primitives de `@/components/pro`
  (`PageHeader`, `Section`, `DataToolbar`, `SearchInput`, `Grid`, `EmptyState`,
  `LoadingState`, `ErrorState`, `StatusPill`, `ActionBar`…) ;
- un besoin non couvert → **ajouter une primitive** dans `src/components/pro/`,
  jamais un `<div className="…">` dans un `page.tsx` ;
- zero couleur brute, zero valeur arbitraire Tailwind, espacements dans l'echelle
  `2 / 4 / 6 / 8`, seule ombre autorisee `shadow-sm` ;
- pages de reference : `src/app/admin/market/contacts/page.tsx` et
  `src/app/admin/market/opportunities/OpportunitiesWorkspace.tsx`.

Verification avant de conclure une tache qui touche l'interface :

```bash
npm run lint:design:changed
```

Zero violation exigee sur toute page nouvelle ou reecrite. La dette des pages
anciennes n'est pas bloquante.

## Attention

- Ne jamais lancer `npm run build` ni `npm run lint:strict` pendant qu'un serveur
  `next dev` tourne : les deux ecrasent `.next` et cassent le serveur en cours.

Lire aussi :

- `docs/DESIGN.md`
- `docs/BRAND.md`
- `docs/DESIGN_UX_GUIDELINES.md`
