# Affaire source unique - decoupage en lots

Date de cadrage : 09/07/2026
Branche de travail : `preview`

## Objectif

Faire de la fiche `Opportunites / Mandats` la source de verite metier cote
admin, du premier contact jusqu'au vendu, tout en gardant `client_dossiers`
comme projection securisee pour le portail client, les documents, les jalons et
les regles RLS.

## Principe produit

- L'opportunite pilote le projet vendeur.
- Le portail client peut etre ouvert des la `Visite d'estimation`.
- Les donnees `Bien & technique` et `Estimation & avis de valeur` sont saisies
  sur l'opportunite.
- `client_dossiers` ne doit plus devenir une deuxieme fiche concurrente : il
  expose au client une projection du projet et porte les objets propres au
  portail (documents, events, acces, statut client).

## Lot 0 - Cadrage et memoire projet

Statut : fait le 09/07/2026.

- Formaliser le decoupage du chantier.
- Aligner `docs/SMQ_PROCESSUS_VENDEUR.md` avec la regle actuelle : portail
  ouvrable des la visite d'estimation.
- Garder `docs/SUIVI_PROJET.md` comme journal de reference.

Verification attendue :

- Serveur local actif sur `http://localhost:3002/app/dashboard`.
- `preview` alignee avec `origin/preview` avant modification.

## Lot 1 - Projection vivante opportunite -> portail

Statut : en cours.

But : le portail et les previews doivent lire les donnees vivantes de
l'opportunite quand elles existent, sans attendre une resynchronisation physique
dans `client_dossiers`.

Travail :

- Ajouter un helper pur de projection qui fusionne :
  - base : `client_dossiers.property_snapshot` et `professional_opinion`,
  - priorite : `opportunities.property_snapshot` et `professional_opinion`.
- Brancher ce helper sur :
  - `getCurrentClientDossier()` pour le portail client connecte,
  - `loadAdminClientDossier()` pour les previews admin/test.
- Ajouter un test unitaire sur la fusion.

Verification :

- Test unitaire du helper.
- `npx tsc --noEmit`.
- Smoke `GET /app/dashboard`.

## Lot 2 - Nettoyage des ecritures concurrentes

Statut : premier correctif fait le 09/07/2026.

But : eviter que deux ecrans ecrivent differemment les memes donnees.

Travail prevu :

- Auditer les `PATCH` qui modifient `client_dossiers.property_snapshot` ou
  `professional_opinion`.
- Faire pointer les modifications admin de bien/estimation vers l'opportunite.
- Garder dans `client_dossiers` uniquement les champs de projection ou de
  portail qui ne vivent pas sur l'opportunite.

Premier correctif :

- `PATCH /api/market/clients/[id]` redirige desormais les patches
  `property_snapshot` / `professional_opinion` vers `opportunities` quand le
  dossier est rattache a une opportunite.
- Le fallback sur `client_dossiers` est conserve pour les dossiers sans
  opportunite.

Verification :

- Tests API clients/opportunities.
- Smoke fiche opportunite avec portail ouvert.

## Lot 3 - Portail client multi-projets

But : un meme client peut avoir plusieurs projets, donc il doit pouvoir acceder
au bon portail.

Travail prevu :

- Remplacer la selection "dernier dossier actif" par une selection explicite ou
  une route projet.
- Garder les liens d'invitation rattaches a un dossier precis.
- Prevoir l'etat "plusieurs dossiers actifs" cote client.

Verification :

- Test client avec deux dossiers actifs sur le meme profil.

## Lot 4 - Experience Affaire unifiee

But : rendre la fiche opportunite suffisamment complete pour remplacer toute
navigation admin vers l'ancienne fiche client.

Travail prevu :

- Clarifier les onglets et les etats verrouilles/deverrouilles.
- Mettre en avant le statut portail, documents, visites et offres sans casser
  la densite admin.
- Ajouter les appels a action manquants : inviter, preview, lien presentation.

Verification :

- Audit Playwright desktop/mobile de `/app/opportunities/[id]`.
- Controle visuel du portail preview.

## Lot 5 - Backfill et simplification schema

But : preparer une base durable une fois le flux confirme.

Travail prevu :

- Identifier les dossiers dont les snapshots divergent de l'opportunite.
- Prevoir un backfill non destructif.
- Decider si certains champs de projection restent denormalises pour la RLS et
  la performance.

Verification :

- Script dry-run avant tout update base.
- Validation explicite avant execution sur Supabase.
