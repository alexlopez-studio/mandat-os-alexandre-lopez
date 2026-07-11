# Memoire de reprise - Mandat OS / MandatFinder

Derniere mise a jour : 18/06/2026

## Regle de reprise prioritaire

Toujours repartir de la derniere branche distante `origin/preview`.

Commande courte de reprise : si Alexandre dit simplement `start`, appliquer le protocole de `docs/START.md`.

Avant toute analyse ou modification :

1. Executer `git fetch --all --prune`.
2. Comparer la branche locale avec `origin/preview`.
3. Si la branche locale est en retard ou sale, ne pas raisonner depuis l'etat local comme source de verite.
4. Ne pas ecraser les changements locaux non commites sans accord explicite.

La branche locale `preview` peut etre en retard. Au 17/06/2026, elle etait encore a `12af742` alors que `origin/preview` etait a `a2c1358`.

## Source de verite actuelle

- Branche de reference : `origin/preview`
- Commit de reference au 17/06/2026 : `a2c1358`
- Projet : `alexlopez-studio/site-alex-lopez-provence`
- Backoffice principal : `/app/dashboard`
- URLs canoniques logiciel : `/app/dashboard`, `/app/leads`, `/app/radar`, `/app/properties`, `/app/acheteurs`, `/app/matching`, `/app/opportunities`, `/app/rules`, `/app/notifications`, `/app/zones`, `/app/settings`, `/app/utilisateurs`.
- Anciennes entrees `/admin/market/*` et `/dashboard/radar` : conservees via redirects/rewrites, mais ne sont plus les URLs a utiliser en navigation courante.
- Ancien suivi Linear : historique utile, mais ne reflete plus l'avancement reel du code.

## Ce qui est deja realise

Les lots historiques 1 a 4 ne sont plus a traiter comme non demarres. Ils ont ete realises puis prolonges.

- Infrastructure Stream Estate / Supabase.
- API backend Mandat OS : biens, sync, regles, notifications, opportunites, zones.
- UI backoffice : dashboard, marche, detail bien, opportunites, regles, notifications.
- Moteur de regles : assistant, execution manuelle, regles preconfigurees.
- Pipeline vendeurs / prospects : `/admin/market/leads`.
- Acquereurs : `/admin/market/acheteurs`.
- Matching : `/admin/market/matching`.
- Zones surveillees : `/admin/market/zones`.
- Centre de controle : `/admin/market/settings`.
- Auth Supabase admin avec roles `super_admin` / `admin`.
- Gestion utilisateurs : `/admin/market/utilisateurs`.
- Liste chaude bouche-a-oreille : `/admin/market/liste-chaude`.
- MandatFinder DDD : `src/lib/mandat/*`, migration core, radar, cron analyse.
- Pipeline MandatFinder avec toggle et cron Vercel.
- Alerting email "fenetre d'or" via Resend apres analyse.
- Corrections recentes Stream Estate : endpoint `stream.estate`, `/documents/properties`, `hydra:member`.
- Sync controlee Stream Estate sur `/app/zones` avec previsualisation budgetee, plafond `max_items` et confirmation explicite.
- Optimisation credits Stream Estate (18/06, local non commite) : filtrage commune `includedZipcodes[]` / `includedInseeCodes[]`, `transactionType=0`, `propertyTypes=[0,1]`, preview gratuit `itemsPerPage=0`, suppression de l'appel preview facture separe, garde-fou anti-re-sync configurable (`stream_estate_resync_window_minutes`, defaut 360 min) avec bypass `force:true`, route diagnostic `test-stream-estate` supprimee. Facturation confirmee : 0,01 EUR/bien.
- Coherence UX zones avec ce flux : toast « deja a jour » + action « Forcer la resync », toast « sync partielle », badge fraicheur aligne sur la fenetre, badge precision INSEE, mention « Estimation gratuit », champ « Fenetre resync (min) » editable dans Reglages.
- Simplification des URLs backoffice vers `/app/*`.
- Sidebar Mandat OS reorganisee par sections metier : Vue d'ensemble, Vendeurs, Acquereurs, Marche, Automatisation, Configuration.

## Branches et organisation du travail

Decision du 17/06/2026 : Codex reste seul sur le developpement et le design pour le moment.

- Branche de travail unique : `preview`.
- Source de verite GitHub : `origin/preview`.
- Les anciennes branches `design/*` et `feat/*` ne doivent plus etre utilisees pour le flux courant, sauf demande explicite d'Alexandre.
- Les branches de sauvegarde locales peuvent rester temporairement pour recuperer un fichier, mais elles ne sont pas des bases de travail.
- Quand Alexandre valide un push, pousser `preview` vers `origin/preview`.
- Ne jamais pousser sans validation explicite d'Alexandre.

## Coordination de travail

Pour eviter tout cafouillage :

- Ne jamais faire de `git reset --hard`, rebase destructif ou checkout qui ecrase des fichiers sans accord explicite.
- Toujours verifier `git status --short --branch` avant de modifier.
- Toujours verifier si `origin/preview` a avance avec `git fetch --all --prune`.
- Travailler localement sur `preview`.
- Si `origin/preview` a avance, stopper et clarifier avant de pousser ou de rebaser.
- La doc du repo remplace Linear pour le suivi courant ; Linear reste seulement un historique.

## Journal d'avancement obligatoire

A chaque nouvelle action de conception, developpement, correction, audit ou decision structurante :

- mettre a jour `docs/SUIVI_PROJET.md`,
- ajouter une entree horodatee dans la section "Journal d'avancement",
- utiliser l'heure locale Europe/Paris,
- mentionner la branche ou base de travail,
- resumer ce qui a ete fait,
- noter les fichiers principaux touches,
- noter l'etat final : fait, en cours, bloque ou a verifier.

Ne pas attendre la fin d'une grosse session pour tracer les changements importants.

## Auditeur qualite Playwright

Le projet doit integrer un reflexe d'audit qualite via Playwright CLI.

Principe :

- apres chaque changement fonctionnel ou design significatif, executer un audit Playwright adapte au changement,
- utiliser `pnpm test:e2e` pour la suite e2e quand le serveur local ou `BASE_URL` est disponible,
- pour un audit cible, lancer Playwright sur le ou les tests concernes,
- conserver les traces/screenshot en cas d'echec,
- noter le resultat dans le journal d'avancement de `docs/SUIVI_PROJET.md`.

Pour le chantier design logiciel, l'auditeur doit couvrir progressivement :

- chargement des pages `/admin/market/*` principales,
- navigation sidebar,
- absence d'erreurs console critiques,
- lisibilite desktop et mobile/tablette quand pertinent,
- absence de debordement horizontal,
- verification des workflows critiques : login, dashboard, zones, settings, liste chaude, matching.

Si l'auth Supabase bloque l'e2e local, documenter le blocage et prevoir une strategie de test dediee : compte de test, mocks, storage state Playwright ou base URL preview authentifiee.

## Priorite design logiciel

Le design concerne le logiciel Mandat OS / MandatFinder, pas le site public.

Preference de visualisation locale :

- utiliser `localhost`, pas `127.0.0.1`,
- ouvrir `http://localhost:<port>/app/dashboard`,
- ouvrir dans VS Code quand c'est possible, via le Simple Browser integre.

Ecrans principaux a prendre en compte :

- `/app/dashboard`
- `/app/leads`
- `/app/liste-chaude`
- `/app/radar`
- `/app/properties`
- `/app/acheteurs`
- `/app/matching`
- `/app/opportunities`
- `/app/rules`
- `/app/notifications`
- `/app/zones`
- `/app/settings`
- `/app/utilisateurs`

Objectif design : unifier ces pages en vrai logiciel metier operationnel, pas en assemblage de templates shadcn.

Points d'attention :

- Garder une interface dense, calme, lisible, orientee decision.
- Eviter les sections marketing ou trop decoratives dans le backoffice.
- Stabiliser la navigation : sidebar, header, statut sync, role utilisateur.
- Rendre les etats metier lisibles : opportunite, baisse de prix, phase vendeur, score, fraicheur zone, alertes.
- Ne pas masquer les workflows utiles derriere des cards trop grandes.

## Etat preview recent a connaitre

Commits recents integres dans `origin/preview` :

- `d2a5e47` : CRM "Liste chaude" + import vCard/CSV.
- `3477453` : auth Supabase + roles admin/super admin + gestion utilisateurs.
- `0aa5c97` : centre de controle sync + zones branchees API.
- `2b6ceab` : communes officielles via `geo.api.gouv.fr` + cascade delete biens.
- `129229e` : toggle pipeline MandatFinder + cron analyse quotidienne.
- `840a824` : email "fenetre d'or" via Resend.
- `77dfe1b`, `768dc0e`, `bb2d9c6` : corrections sync / Stream Estate.
- `a2c1358` : route diagnostic `test-stream-estate` (DESORMAIS supprimee dans le working tree local, non commite).

Travail local en cours non commite sur `preview` (18/06, apres `65a3cfd`) : optimisation credits Stream Estate + coherence UX zones. Migration `011_stream_estate_resync_window.sql` **appliquee sur Supabase** (`byrsmbgfkvgxdtdyhrro`, cle `stream_estate_resync_window_minutes=360`). Migrations `009`/`010` appliquees hors tracker Supabase (le tracker ne liste que `006`/`008`) : prudence avant tout `supabase db push`. `npx tsc --noEmit` + `npm run build` OK. En attente de validation d'Alexandre pour un commit unique.

## Documents utiles

- `docs/SUIVI_PROJET.md` : suivi projet mis a jour.
- `docs/CAHIER_DES_CHARGES.md` : cahier des charges historique.
- `docs/MANDATFINDER_ARCHITECTURE.md` : architecture DDD MandatFinder.
- `docs/ATTIO_CRM.md` : contexte CRM externe.

## A ne pas refaire

- Ne pas repartir du suivi initial qui indiquait Lot 2/3/4 a 0%.
- Ne pas supposer que `/admin` est l'etat du logiciel : la navigation courante passe par `/app/dashboard`, les routes `/admin/market/*` sont des routes historiques/rewrite.
- Ne pas confondre design public du site vitrine et design du logiciel.
- Ne pas rebaser ou reset sans verifier les changements locaux.
