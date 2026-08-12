# Plan d'allegement de Mandat OS

Audit realise le 13/08/2026, apres la suppression du Radar MandatFinder.
Objectif : ne garder que les pages reellement en service, reduire la surface de
code a maintenir et alleger les bundles client.

## Etat des lieux mesure

Build de reference (`npm run build`, apres suppression du Radar) :

| Route | First Load JS |
|-------|---------------|
| `/app/opportunities/[id]` | **356 kB** |
| `/app/clients/[id]/preview` | 258 kB |
| `/app/dashboard` | 234 kB |
| `/app/opportunities` | 234 kB |
| `/app/acheteurs/[id]` | 229 kB |
| `/app/contacts` | 217 kB |
| Socle partage | 102 kB |
| Middleware | 90,8 kB |

Volumetrie du code : 29 pages, 108 routes API, ~33 600 lignes de TSX sous
`src/app` + `src/components`.

Constat principal : la moitie du poids ne vient pas des pages utilisees tous les
jours mais de **restes de fonctionnalites abandonnees** encore compilees.

---

## Lot 1 — Dependances jamais importees

19 paquets dans `package.json` ne sont references nulle part dans `src/`.

| Paquet | Pourquoi il est mort |
|--------|----------------------|
| `@radix-ui/react-avatar`, `-checkbox`, `-dialog`, `-dropdown-menu`, `-label`, `-progress`, `-select`, `-separator`, `-slot`, `-tabs`, `-toggle`, `-toggle-group`, `-tooltip` (13 paquets) | Le code utilise le paquet unifie `radix-ui` (17 fichiers). Les paquets individuels sont des doublons herites de shadcn. |
| `react-hook-form`, `@hookform/resolvers` | Aucun formulaire ne les utilise (tout est en `useState`). |
| `pg` | Aucun acces Postgres direct : tout passe par `@supabase/supabase-js`. |
| `resend` | `src/lib/resend.ts` appelle l'API HTTP en `fetch`, sans le SDK. |
| `@tanstack/react-table`, `@dnd-kit/modifiers` | Uniquement dans `src/components/data-table.tsx`, qui n'est monte nulle part (lot 2). |

**Gain** : `node_modules` (693 Mo aujourd'hui), temps de `npm install`, surface
de mises a jour de securite. Aucun impact fonctionnel.
**Risque** : nul, verifie par `npm run lint` + `npm run build`.
**Effort** : 15 min.

---

## Lot 2 — Composants du template shadcn jamais montes

1 333 lignes de composants racine + 3 primitives `ui/` sans un seul import :

| Fichier | Lignes |
|---------|--------|
| `src/components/data-table.tsx` | 828 |
| `src/components/chart-area-interactive.tsx` | 292 |
| `src/components/nav-documents.tsx` | 85 |
| `src/components/section-cards.tsx` | 53 |
| `src/components/site-header.tsx` | 33 |
| `src/components/nav-secondary.tsx` | 42 |
| `src/components/ui/breadcrumb.tsx`, `ui/drawer.tsx`, `ui/progress.tsx` | — |

`site-header.tsx` est particulierement trompeur : il maintient une table de
titres de pages alors que `MarketShell` a son propre header depuis longtemps.
C'est ce fichier qui gardait encore une entree « Radar » aujourd'hui morte.

**Gain** : -1 333 lignes, et la suppression de `data-table.tsx` debloque le
retrait de `@tanstack/react-table` et `@dnd-kit/modifiers` (lot 1).
**Risque** : nul.
**Effort** : 20 min.

---

## Lot 3 — Pages injoignables

| Page | Lignes | Situation |
|------|--------|-----------|
| `/app/zones` | 978 | `next.config.ts` redirige `/app/zones` vers `/app/settings?section=communes`. **La page ne peut plus jamais s'afficher** mais elle est toujours compilee (133 kB). |
| `/app/matching` | 407 | Aucun lien entrant dans toute l'app. Seule trace : une ligne dans `site-header.tsx` (lot 2). |
| `/app/clients`, `/app/clients/[id]` | 29 | Deux `redirect()` d'une ligne vers `/app/opportunities` et `/app/acheteurs/...`. A garder si des favoris existent, sinon a supprimer. |

**Gain** : -1 400 lignes, deux routes de moins a builder.
**Risque** : verifier avant suppression de `/app/zones` que la section
« communes » des parametres couvre bien tout ce que faisait l'ancienne page.
**Effort** : 1 h (dont la verification de parite fonctionnelle sur les zones).

---

## Lot 4 — Pipeline MandatFinder mort

Meme cause que le Radar : les tables `listings`, `listing_events` et
`seller_scores` de la migration `005_mandatfinder_core.sql` **n'existent pas en
base de production**. Tout ce qui les lit ou les ecrit est inerte.

| Element | Lignes | Statut |
|---------|--------|--------|
| `src/lib/mandat/import-service.ts` | 230 | ecrit dans `listings` — inerte |
| `src/lib/mandat/analysis-service.ts` | 268 | orchestre le batch — inerte |
| `src/lib/mandat/event-service.ts` | 191 | ecrit dans `listing_events` — inerte |
| `src/lib/mandat/alert-service.ts` | 140 | alertes « fenetre d'or » — inerte |
| `/api/jobs/import-stream-estate` | 60 | seul appelant de `import-service` |
| `/api/jobs/analyze-listings` | 60 | seul appelant de `analysis-service` |

Ce qui est **reellement en service** dans `src/lib/mandat/` se limite a :

- `types.ts` — les types `SellerPhase` / `SellerScore`, utilises par les pages Biens ;
- `scoring-service.ts` — `calculateScore()`, appele par
  `src/lib/market/mandate-score.ts` qui lui travaille sur `market_properties`.

Recommandation : conserver `types.ts` et `scoring-service.ts`, supprimer les
quatre autres services et les deux jobs. Le cron Vercel actif
(`/api/jobs/sync-zones`) n'est pas concerne : il alimente `market_properties` et
reste la source de verite.

**Gain** : -950 lignes, deux endpoints de moins, et surtout la fin d'une
ambiguite couteuse — aujourd'hui deux systemes de scoring coexistent dans le
code alors qu'un seul tourne.
**Risque** : faible, mais c'est une decision produit — si le pipeline
MandatFinder doit revivre un jour, mieux vaut le reconstruire sur
`market_properties` que ressusciter ces fichiers.
**Effort** : 1 h.

---

## Lot 5 — Doublon de l'espace client

`src/app/espace-client/` contient 3 724 lignes (dont `portal-view.tsx` a lui
seul : 2 983) **mais aucune `page.tsx`** : la route `/espace-client` renvoie un
404. Le portail vendeur vit desormais dans un depot separe
(`espace-client-alexandre-lopez`, port 3001, declare dans `.claude/launch.json`).

Ces fichiers ne survivent que pour une chose : la page d'apercu admin
`/app/clients/[id]/preview`, qui importe `ClientPortalView`. C'est elle qui
explique ses 258 kB de First Load JS, et elle tire `framer-motion` et `leaflet`
avec elle.

Trois options, par ordre de preference :

1. **Supprimer la page d'apercu et le dossier** — l'apercu se fait en ouvrant le
   vrai portail sur le lien client (bouton « lien client » deja present dans la
   fiche opportunite). -3 700 lignes, -258 kB sur une route.
2. **Remplacer l'apercu par une iframe** vers le portail du depot separe.
   Garde la fonctionnalite, supprime le duplicata de code.
3. **Ne rien faire** et accepter que le portail existe en deux exemplaires qui
   vont diverger.

C'est le seul lot qui demande un vrai arbitrage produit de ta part.

**Effort** : 30 min (option 1), 2 h (option 2).

---

## Lot 6 — Routes API sans appelant

24 des 108 routes API n'ont aucun appelant dans le depot. A trier en trois
categories :

**Legitimes malgre l'absence d'appelant interne — a garder :**
`/api/jobs/sync-zones` (cron Vercel), `/api/integrations/google/oauth/callback`,
`/api/integrations/telegram/webhook`, `/api/market/webhooks/stream-estate`.

**Mortes avec le pipeline MandatFinder (lot 4) :**
`/api/jobs/analyze-listings`, `/api/jobs/import-stream-estate`.

**A statuer :** `/api/adresse-infos`, `/api/audit`, `/api/environment-profile`,
`/api/outils/checks`, `/api/admin/bootstrap`, `/api/ai/actions`, `/api/contact`,
`/api/leads/manual`, `/api/leads/stats`, `/api/market/matching/migrate`,
`/api/market/warm-contacts` (+3 sous-routes), `/api/client/*`,
`/api/client-portal/dossier`, `/api/dev/client-portal-test-dossiers`.

Deux cas notables :

- **`/api/dev/*`** ne devrait pas exister en production, quel que soit son usage.
- **Les 4 routes `warm-contacts`** correspondent a la « liste chaude », une
  rubrique qui n'a plus ni page ni entree de menu. Soit la fonctionnalite
  revient, soit ces routes et la table associee partent ensemble.

**Gain** : moins de surface exposee (donc moins a securiser), build plus rapide.
**Risque** : reel si une route est appelee depuis l'exterieur (Make, Zapier,
formulaire du site vitrine). **A verifier dans les logs Vercel avant toute
suppression** — c'est le seul lot ou l'analyse statique ne suffit pas.
**Effort** : 2 h dont la verification des logs.

---

## Lot 7 — Pages vivantes mais absentes du menu

Ce ne sont pas des pages mortes : elles fonctionnent, mais aucune entree de
sidebar n'y mene. Elles sont donc soit inutilisees, soit atteintes a l'URL.

| Page | Poids | Question |
|------|-------|----------|
| `/app/utilisateurs` | 158 kB | Reserve au super admin, aucun lien nulle part. A relier dans « Configuration ». |
| `/app/rules` + `/app/rules/new` | 129 kB | Le moteur de regles est-il utilise ? Sinon c'est le plus gros candidat a la suppression apres l'espace client. |
| `/app/notifications` | 118 kB | Doublon partiel du `NotificationsSheet` du header. Ajouter un lien « tout voir » depuis le sheet, ou supprimer la page. |
| `/app/acheteurs/[id]` | 229 kB | Atteinte depuis les kanbans acquereurs — normal, mais la page merite un decoupage (1 652 lignes). |

**Aucune action automatique ici** : il me faut ta reponse sur regles /
notifications / utilisateurs avant de trancher.

---

## Lot 8 — Divers

- `src/lib/site-visuals.ts` (93), `src/lib/analytics.ts` (93),
  `src/lib/animations.ts` (55), `src/lib/territory.ts` (9) : aucun import.
- `npm test` execute les tests **en double** parce que vitest ramasse aussi
  `.claude/worktrees/cool-dhawan-ec1de9/`, une copie complete du depot de 31 Mo.
  A exclure dans la config vitest (317 tests deviendraient ~160, duree divisee
  par deux).
- `test:e2e` pointe sur Playwright alors qu'aucun test e2e n'existe. Soit on en
  ecrit, soit on retire le script et la devDependency (`@playwright/test`).
- `db.sql` a la racine est un fichier vide non versionne — a supprimer.

---

## Ordre d'execution propose

| # | Lot | Gain | Risque | Effort |
|---|-----|------|--------|--------|
| 1 | Lots 1 + 2 + 8 (deps, composants template, divers) | -1 400 lignes, -19 paquets, tests 2x plus rapides | nul | 1 h |
| 2 | Lot 4 (pipeline MandatFinder) | -950 lignes, fin de l'ambiguite scoring | faible | 1 h |
| 3 | Lot 3 (pages injoignables) | -1 400 lignes, -2 routes | faible | 1 h |
| 4 | Lot 5 (espace client) | -3 700 lignes, -258 kB | arbitrage produit | 0,5 a 2 h |
| 5 | Lot 6 (routes API) | -15 a 20 routes | a valider dans les logs | 2 h |
| 6 | Lot 7 (pages hors menu) | variable | decision produit | a definir |

Cumul des lots 1 a 4 : **environ 7 500 lignes en moins**, soit un quart du code
d'interface, sans toucher a une seule fonctionnalite en service.

## Ce que ce plan ne fait pas

Alleger le code mort ne reduit pas mecaniquement le First Load JS des pages qui
restent — ces pages ne l'importaient deja pas. Les 356 kB de
`/app/opportunities/[id]` viennent de la page elle-meme (2 916 lignes) et de ses
dependances reelles. Si l'objectif est la performance percue sur les pages
quotidiennes, c'est un chantier distinct : decouper `opportunities/[id]` et
charger `DossierWorkspace`, `KanbanBoard` et les onglets secondaires en
`next/dynamic`. A traiter apres le menage, pas a la place.
