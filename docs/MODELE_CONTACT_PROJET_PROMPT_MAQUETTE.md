# Prompt maître — maquette du modèle Contact / Projet

Destiné à Google AI Studio, à utiliser avant le Lot 1 de
`MODELE_CONTACT_PROJET_LOTS.md`.

**Aucune donnée client réelle** : les noms, adresses et montants ci-dessous
sont inventés. Ne pas les remplacer par de vrais dossiers — ce serait
transmettre des données personnelles à un service tiers.

Copier tout le bloc ci-dessous.

---

```
Tu es designer produit et développeur front-end. Produis une maquette
interactive en HTML + Tailwind CSS dans un seul fichier, sans dépendance
externe autre que le CDN Tailwind.

## Le contexte

Mandat OS est un logiciel métier interne, à utilisateur unique : Alexandre
Lopez, conseiller immobilier indépendant (mandataire, jamais « agence ») en
Provence Verte — Brignoles, Saint-Maximin, Barjols, Rocbaron, Nans-les-Pins.

Il travaille seul, souvent entre deux rendez-vous. C'est un OUTIL DE TRAVAIL,
pas un site vitrine : densité d'information élevée, lecture rapide, aucune
section marketing.

## Ce que la maquette doit prouver

Le logiciel passe d'un modèle confus (des « opportunités » qui mélangent
vendeurs et acquéreurs, plus une base de contacts séparée) à trois objets
clairs :

- CONTACT : une personne. Une seule fiche, quelle que soit son origine.
- PROJET : de type VENTE ou ACHAT. Porte une étape, une priorité, une
  prochaine action, une échéance.
- ACTIVITÉ : note, tâche, appel, visite, email — rattachée à un projet.

Un contact et un projet sont liés par un RÔLE : vendeur, co-vendeur,
acquéreur, conjoint, notaire, apporteur.

Trois cas doivent être visibles dans la maquette, ce sont eux qui justifient
le modèle :
1. un couple qui vend ensemble = 2 contacts sur 1 projet ;
2. une personne qui vend ET rachète = 1 contact, 2 projets, visibles ensemble
   sur sa fiche ;
3. un apporteur rattaché à un projet sans apparaître dans le pipeline.

## Les trois écrans à maquetter

### Écran 1 — Pipeline des projets
Vue liste dense, triable. Colonnes : projet (intitulé + commune), type
(badge vente ou achat), contacts rattachés (avatars ou initiales), étape,
prochaine action, échéance, priorité.
Filtres en haut : type (tous / vente / achat), étape, échéance (en retard,
cette semaine). Un compteur par filtre actif.
Les lignes en retard doivent se repérer immédiatement, sans couleur criarde.

### Écran 2 — Fiche projet (prendre un projet de vente)
En-tête : intitulé, commune, badge de type, étape courante avec possibilité
de la faire avancer, priorité, échéance.
Un bloc CONTACTS RATTACHÉS listant chaque personne avec son rôle, son
téléphone et son email, avec une action « ajouter un contact ».
Un bloc BIEN (spécifique au type vente) : adresse, type, surface, pièces,
fourchette d'estimation.
Un bloc ACTIVITÉS : fil chronologique de notes, tâches et rendez-vous, avec
l'auteur et la date, et un champ d'ajout rapide en haut. Les tâches non
faites affichent leur échéance et une case à cocher.

### Écran 3 — Fiche contact
En-tête : nom, téléphone, email, commune, date du premier contact.
Un bloc SES PROJETS : la liste de tous ses projets, vente et achat confondus,
avec le rôle qu'il y tient et l'étape de chacun. C'est l'écran qui doit
rendre évident qu'une même personne peut vendre et racheter.
Un bloc ACTIVITÉS : toutes ses activités, tous projets confondus, avec
l'indication du projet concerné.

## Charte visuelle — à respecter strictement

Couleurs :
- accent principal #0077B6 (bleu Méditerranée), hover #005F96
- fond teinté / badges #E0F0FA
- texte principal #0F172A, texte secondaire #64748B
- bordures #E2E8F0, fond de section #F8FAFC
- succès #10B981, attente #B26A00, erreur #EF4444

Typographie : Inter, weights 400 à 800. Titres de section 20px/800, titres de
ligne 16px/700, corps 15px/400, méta 13px/300.

Boutons : arrondis complets (rounded-full). Primaire = fond #0077B6 texte
blanc. Secondaire = fond #0F172A texte blanc. Outline = bordure #E2E8F0 fond
blanc.

À faire : navigation stable, tableaux, filtres, badges, statuts, onglets,
actions explicites, densité raisonnable, états vides utiles, boutons avec
icônes quand l'action est un outil.

À éviter absolument : hero marketing, grosses cards imbriquées, longs textes
explicatifs dans l'interface, effets visuels ralentissant la lecture, palette
dominée par une seule couleur, et AUCUNE section sombre — alternance blanc et
#F8FAFC uniquement.

Desktop d'abord (c'est un outil de bureau), mais rien ne doit déborder ni
devenir illisible en dessous de 768px.

## Étapes du pipeline

VENTE : Nouveau contact → Pré-estimation → Visite d'estimation → Remise de
l'estimation → Décision vendeur → Suivi moyen terme → Mandat signé → Vendu →
Perdu / Écarté.

ACHAT (proposition à valider) : Nouveau contact → Critères qualifiés →
Visites en cours → Offre déposée → Compromis signé → Acquis → Perdu.

## Jeu de données à utiliser — noms fictifs

Contacts :
- Martine et Paul Vasseur, 06 12 34 56 78, Brignoles — vendent ensemble
- Claire Fontaine, 06 98 76 54 32, Saint-Maximin — vend sa maison ET
  cherche un appartement (le cas à mettre en évidence)
- Julien Ramel, 06 11 22 33 44, Barjols — cherche une maison
- Sophie Bertin, 06 55 44 33 22 — apporteuse, a présenté les Vasseur

Projets :
- VENTE — Maison Vasseur, Brignoles, 140 m², 5 pièces, estimation
  385 000 à 410 000 €, étape « Visite d'estimation », prochaine action
  « Remettre l'avis de valeur », échéance dans 3 jours, priorité haute.
  Contacts : Martine Vasseur (vendeur), Paul Vasseur (co-vendeur),
  Sophie Bertin (apporteur).
- VENTE — Maison Fontaine, Saint-Maximin, 95 m², estimation 295 000 à
  315 000 €, étape « Décision vendeur », échéance dépassée de 2 jours.
  Contact : Claire Fontaine (vendeur).
- ACHAT — Recherche Fontaine, appartement 3 pièces, Saint-Maximin ou
  Brignoles, budget 240 000 €, étape « Critères qualifiés ».
  Contact : Claire Fontaine (acquéreur).
- ACHAT — Recherche Ramel, maison avec piscine, Barjols et alentours,
  budget 320 000 €, étape « Visites en cours », prochaine action
  « Caler la visite de samedi ». Contact : Julien Ramel (acquéreur).

Activités d'exemple : une note de visite, une tâche en retard, un appel
sortant, un rendez-vous à venir. Auteurs : « Alexandre » ou « Assistant IA ».

## Livrable

Un seul fichier HTML, les trois écrans navigables par des onglets en haut.
Les filtres et les onglets doivent réellement fonctionner en JavaScript. Pas
de backend, pas d'appel réseau, données en dur dans le fichier.
```
