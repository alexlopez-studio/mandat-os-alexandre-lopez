# Modèle Contact / Projet — découpage en lots

Date de cadrage : 07/08/2026
Branche de travail : `preview`
Statut global : **en attente de validation de la maquette**

**Règle de progression** : ne pas entamer un lot avant que le critère de
vérification du précédent soit vert. Chaque lot doit laisser l'application
fonctionnelle — aucune journée sans app utilisable.

---

## Le problème

Deux incohérences structurelles, constatées sur les données réelles du
07/08/2026.

**La personne n'est pas une entité.** Elle a quatre représentations selon la
porte d'entrée : `prospects` (formulaire du site), une chaîne de texte dans
`opportunities.seller_name` (Telegram ou saisie manuelle), `warm_contacts`
(réseau), `client_profiles` (portail). Sur 5 opportunités, **3 n'ont aucun
contact rattaché** : le vendeur n'y est qu'un nom recopié, introuvable et sans
historique.

**Le projet est coupé en deux tables.** Un projet de vente est une
`opportunity`, un projet d'achat est un `buyer_criteria`. Deux structures pour
la même idée — un projet, une étape, une prochaine action, une échéance. D'où
le mélange perçu dans l'écran « Opportunités / Mandats ».

Symptôme déjà rencontré : les notes dictées sur un acquéreur s'affichaient
vides, parce que les activités vivent dans `opportunity_events` pour les
vendeurs et dans `lead_events` pour les acquéreurs, avec des formats
différents. Ce n'était pas un bug isolé mais le schéma qui remonte.

Par ailleurs « mandat » n'est pas un objet : c'est une **étape** d'un projet de
vente. Le placer au même niveau qu'« opportunité » entretient la confusion.

## Le modèle cible

```
CONTACT ──< PROJET_CONTACT >── PROJET (vente | achat)
(la personne)   (avec un rôle)      │
                                    ├── détail vente : le bien
                                    ├── détail achat : les critères
                                    └── ACTIVITÉS (notes, tâches, RDV)
```

La table de liaison est ce qui débloque les cas réels :

- un couple qui vend = 2 contacts, 1 projet ;
- une personne qui vend **et** rachète = 1 contact, 2 projets, visibles
  ensemble sur sa fiche — aujourd'hui structurellement invisible ;
- un apporteur, un notaire, un conjoint se rattachent avec leur rôle sans
  polluer le pipeline.

Les critères d'achat et le bien à vendre ne disparaissent pas : ils deviennent
le *détail* du projet selon son type.

**Hors périmètre** : `market_properties` (annonces captées) reste de la donnée
de marché, pas un projet.

---

## Lot 0 — Cadrage, vocabulaire et maquette

Statut : **en cours**.

But : figer le vocabulaire et valider l'ergonomie cible avant toute ligne de
SQL. Le vocabulaire est le levier le moins cher pour la fluidité et ne coûte
aucune migration.

Travail :

- Vocabulaire retenu : **Contact**, **Projet** (vente ou achat), **Activité**.
  « Mandat signé » redevient une étape du projet de vente. À arbitrer :
  est-ce « projet » ou « mandat » qu'Alexandre emploie devant un client ?
- Trancher si les co-vendeurs sont un cas fréquent — si oui, la liaison
  multi-contacts est indispensable dès le Lot 1.
- Produire la maquette des trois écrans cibles via le prompt maître
  (annexe A) et la valider.

Vérification : maquette validée par Alexandre, vocabulaire arbitré.

## Lot 1 — La personne devient réelle

Statut : à faire.

But : une personne, une ligne, quelle que soit sa porte d'entrée.

Travail :

- Tables `contacts` et `project_contacts` (avec `role`).
- Reprise de `prospects`, `warm_contacts` et des noms recopiés dans
  `opportunities.seller_name` / côté acquéreur.
- Rapprochement des doublons évidents (même téléphone ou même email).
- Aucun écran modifié : l'ancien modèle continue de tourner en parallèle.

Vérification : chaque projet de vente et d'achat a au moins un contact
rattaché ; aucun `seller_name` orphelin ; tests de reprise.

## Lot 2 — Journal d'activité unique

Statut : à faire.

But : une note est une note, qu'elle porte sur un vendeur ou un acquéreur.

Travail :

- Table d'activités unique, reprise de `lead_events` (notes Telegram
  acquéreur) vers ce journal.
- Chemin d'écriture unique pour l'agent Telegram et pour l'app.

Vérification : les notes dictées sur un acquéreur s'affichent ; l'agent n'a
plus deux branches selon le type de dossier.

## Lot 3 — Fiche contact

Statut : à faire.

But : premier bénéfice visible. Une page par personne, avec tous ses projets
et toutes ses activités.

Travail :

- Écran fiche contact : coordonnées, projets rattachés avec leur rôle,
  activités consolidées.
- Recherche par nom, téléphone, email.

Vérification : une personne vendeuse et acheteuse apparaît avec ses deux
projets sur une seule fiche.

## Lot 4 — Le projet unifié — **point de non-retour**

Statut : à faire, **sous réserve d'une décision explicite après le Lot 3**.

But : un seul pipeline.

Travail :

- Table `projects` avec `kind` (`vente` | `achat`), étape, priorité,
  prochaine action, échéance.
- Reprise de `opportunities` et `buyer_criteria`.
- Anciennes tables conservées en vues le temps de basculer les écrans.

Vérification : parité fonctionnelle écran par écran avant de basculer ;
`npm run lint` et suite de tests vertes.

## Lot 5 — Pipeline et écrans

Statut : à faire.

But : la cohérence se voit enfin.

Travail :

- Pipeline unique avec filtre vente / achat.
- Fiche projet unifiée, contacts rattachés visibles avec leur rôle.
- Retrait du vocabulaire « opportunité / mandat / lead » de l'interface.

Vérification : rendu desktop et mobile ; cohérence avec `docs/BRAND.md`.

## Lot 6 — Agent Telegram et nettoyage

Statut : à faire.

But : l'agent parle le même langage que l'app.

Travail :

- `creer_vendeur` / `creer_acquereur` → `creer_projet` avec un type.
- `chercher_dossier` → `chercher_contact` et `chercher_projet`.
- Retrait des vues de compatibilité et des tables mortes.

Vérification : boucle complète testée depuis Telegram ; aucune référence aux
anciennes tables.

---

## Annexe A — Prompt maître pour la maquette

Prompt autonome destiné à Google AI Studio, à utiliser avant le Lot 1.
Il ne contient **aucune donnée client réelle** : les noms et adresses sont
inventés, pour ne pas transmettre de données personnelles à un service tiers.

Le prompt vit dans `docs/MODELE_CONTACT_PROJET_PROMPT_MAQUETTE.md`, à côté de
ce découpage, pour que la maquette validée reste traçable avec les lots.
