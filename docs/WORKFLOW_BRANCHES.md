# Workflow Git — preview local unique

## Branches principales

- `main` : production stable. Ne pas travailler directement dessus.
- `preview` : branche de reference, de travail local et d'integration preview Vercel.
- `origin/preview` : source de verite GitHub.

## Regle actuelle

Le flux projet est volontairement simplifie :

- garder uniquement `preview` en local par defaut ;
- travailler, tester et committer sur `preview` ;
- pousser vers `origin/preview` uniquement quand Alexandre le demande explicitement ;
- ne pas creer de branches locales `feat/*`, `fix/*`, `design/*`, `ux/*`, `ui/*` ou `a11y/*` sauf decision explicite ;
- supprimer les anciennes sous-branches locales apres integration dans `preview`.

## Demarrage de session

Au debut d'une session :

1. Lire `docs/START.md`.
2. Faire `git fetch --all --prune`.
3. Verifier `git status --short --branch`.
4. Comparer `preview` et `origin/preview`.
5. Ne faire aucun reset, rebase destructif ou ecrasement sans demande explicite.

## Flux quotidien

1. `git switch preview`
2. `git pull --ff-only origin preview`
3. Modifier le code ou la documentation.
4. Verifier localement.
5. Mettre a jour `docs/SUIVI_PROJET.md`.
6. Committer sur `preview`.
7. Attendre l'ordre explicite d'Alexandre avant `git push origin preview`.

## Exception : sous-branche temporaire

Une sous-branche peut encore etre creee si Alexandre le demande ou si le risque le justifie clairement.

Noms reserves en cas d'exception :

- `feat/<scope>` : fonctionnalite produit, backend, donnees, APIs.
- `fix/<scope>` : correction non urgente.
- `hotfix/<scope>` : correction urgente preview/production.
- `chore/<scope>` : maintenance, config, outillage.
- `docs/<scope>` : documentation.
- `design/<surface>` : refonte ou direction visuelle.
- `ux/<flow>` : amelioration d'un parcours ou d'une interaction.
- `ui/<component>` : composant ou systeme UI local.
- `a11y/<scope>` : accessibilite.

Toute sous-branche temporaire doit etre mergee dans `preview`, puis supprimee localement apres validation.

## Zones de responsabilite

Claude Code prioritaire :

- schema de donnees, migrations Supabase, RLS.
- APIs, services backend, jobs, integrations externes.
- logique metier, matching, scoring, notifications.
- tests de logique et robustesse technique.
- deploiement preview fonctionnel.

Codex prioritaire :

- layout, composants, etats UI, responsive.
- parcours admin et public.
- design system, tokens, densite d'information.
- copy courte dans l'interface.
- accessibilite clavier, contrastes, focus states.
- verification visuelle avant livraison.

## Regle preview

`preview` doit rester deployable. Si une branche casse le build, elle reste hors de `preview` jusqu'a correction.
