# Backlog produit — Mandat OS

> Fonctionnalités à venir, au-delà du MVP. Capturées pour ne pas les perdre ;
> non priorisées définitivement, à cadrer une par une avant implémentation.
> Le journal d'avancement reste dans `docs/SUIVI_PROJET.md`.

## Vision transverse

Faire de Mandat OS non seulement un outil de prospection (détection de mandats via
le score vendeur), mais aussi un **espace de pilotage de la vente partagé avec le
client** : suivre une vente immobilière comme on pilote un projet d'entreprise
(jalons, documents, KPI, communication), tout en servant de vitrine de la **marque**
d'Alexandre.

### Implication structurante à trancher en amont

Le cahier des charges actuel est **mono-utilisateur (Alexandre, pas de multi-tenant)**.
Plusieurs features ci-dessous (espace client, stats côté client) supposent un **accès
externe authentifié pour les clients**. Cela impose, avant de commencer :

- un modèle d'**authentification client** distinct de l'auth admin (actuellement neutralisée en local — voir `docs/SUIVI_PROJET.md`) ;
- une notion de **propriété / périmètre** : un client ne voit que son dossier et son bien ;
- des règles RLS Supabase par rôle (`admin` vs `client`).

---

## 1. Espace client — dépôt de documents & montage de dossier

**Objectif** : un portail où le client dépose les documents et pièces demandés pour
monter le dossier de vente efficacement (diagnostics, titre de propriété, pièces
d'identité, justificatifs, etc.).

**Valeur** : accélère la constitution du dossier, centralise les pièces, réduit les
allers-retours mail.

**Pistes** :
- Liste de pièces requises (checklist par dossier, statut manquant/reçu/validé).
- Upload sécurisé → Supabase Storage, métadonnées en base, lien au dossier/bien.
- Vue admin (Alexandre relance / valide) + vue client (ce qui reste à fournir).

**Dépend de** : auth client + modèle dossier/bien.

## 2. Statistiques d'annonce côté client — transparence performance

**Objectif** : donner au client l'accès aux statistiques de son annonce (vues,
contacts, évolution dans le temps) pour être transparent sur la performance de son bien.

**Valeur** : confiance, pédagogie sur le positionnement prix, justification des
recommandations (ex. baisse de prix appuyée par les données).

**Pistes** :
- Sources de données de performance (portails, Stream Estate, saisie manuelle ?) — à clarifier.
- Vue client en lecture seule ; graphiques d'évolution ; mise en perspective marché.
- Croiser avec le `mandate_score` / signaux déjà calculés côté Mandat OS.

**Dépend de** : auth client ; disponibilité réelle des métriques d'audience.

## 3. Suivi de projet & KPI de la vente

**Objectif** : amener des éléments de suivi du projet de vente et des KPI dédiés.

**Valeur** : visibilité partagée sur l'avancement, objectivation du processus.

**Pistes** :
- KPI vente : délai depuis mise en marché, nb de visites, nb de contacts, écart prix
  affiché/marché, étape en cours, prochaine action.
- Tableau de bord dossier (côté admin et côté client, périmètre adapté).

## 4. Gestion de projet de la vente (cœur de la vision)

**Objectif** : suivre la vente comme un projet d'entreprise — véritable gestion de projet.

**Valeur** : différenciant fort ; structure la relation et rassure le vendeur.

**Pistes** :
- Jalons d'une vente (mandat → préparation dossier → diffusion → visites → offres →
  compromis → acte) avec statut, dates, responsables.
- Tâches/actions assignables, échéances, rappels.
- Fil d'activité / timeline du dossier ; lien avec documents (1) et KPI (3).
- Réutiliser/étendre le pipeline d'opportunités existant ? À cadrer.

## 5. Marque & identité — outil de communication client

**Objectif** : développer la marque et l'identité d'Alexandre à travers l'outil de
gestion et de communication avec les clients.

**Valeur** : l'espace client devient un point de contact de marque, pas seulement
fonctionnel.

**Pistes** :
- Personnalisation visuelle (logo, couleurs, ton) — voir `docs/BRAND.md`.
- Messages/communications cadrés à la marque ; emails transactionnels soignés
  (cf. `golden-alert-template`).
- Cohérence avec le site vitrine existant.

## 6. Intégration Plaud Pro (API) — transcriptions & comptes rendus

**Objectif** : relier Plaud Pro en API au logiciel pour intégrer les transcriptions
vocales et tous les comptes rendus dans l'application.

**Valeur** : capter automatiquement les échanges (RDV, visites, appels) et les
rattacher au bon dossier/bien/contact ; mémoire du dossier.

**Pistes** :
- Vérifier l'existence et le périmètre d'une **API publique Plaud Pro** (auth, webhooks,
  format des transcriptions) — **à confirmer**.
- Rattacher une transcription / un compte rendu à un dossier, un bien, une opportunité
  ou un contact.
- Stockage + recherche ; éventuel résumé automatique (LLM) des comptes rendus.

**Dépend de** : disponibilité et conditions de l'API Plaud Pro.

---

_Dernière mise à jour : 22/06/2026 — backlog initial saisi par Alexandre._
