# CDC — Refonte du contrôle Stream Estate (dashboard + push event-driven)

> Cahier des charges validé avec Alexandre. Statut : Lot 1 en cours.
> Source de vérité technique : la doc officielle https://docs.stream.estate

## Contexte

La page **Paramètres** (`/admin/market/settings`) empile 6 sections hétérogènes autour de
Stream Estate (conso, budget, cadence en heures, fraîcheur par zone, historique, config).
C'est dense et le pilotage du budget n'est pas lisible.

La détection des nouvelles annonces repose aujourd'hui sur un **scan complet récurrent** d'une
zone (coûteux, facturé au prorata des items en ligne, espacé à 1×/semaine dans le cron). Or
l'API Stream Estate est **event-driven** (`Property → Advert → Event`) avec **saved searches +
webhooks** qui poussent en temps réel les nouveaux matchs et les changements (prix, photos,
surface, expiration). C'est exactement le besoin : *« du push uniquement sur les annonces qui
bougent, rien sur le statique »*.

**Résultat visé** : un dashboard Stream Estate unique et épuré (conso J+M, réglages, historique),
une sync manuelle au nombre d'items réglable (dont illimité = toute la base en ligne, avec
aperçu/confirmation), les **webhooks** comme capteur principal (temps réel), un **pull
incrémental** (`fromDate`/`fromUpdatedAt`) en filet de sécurité, et un monitoring de
réconciliation cadencé **en jours**.

## Décisions validées

- **Architecture cible** : webhooks (saved search) **primaire** + pull incrémental en filet.
- **Monitoring** : conserver les 4 phases (or/chaud/tiède/froid) mais **exprimées en jours**.
- **Sync manuelle illimitée** : **aperçu + confirmation** (comptage gratuit `itemsPerPage=0`).
- **Dashboard épuré** : garder **Consommation J+M**, **Réglages sync & budget**, **Historique** ;
  retirer « Fraîcheur par zone » et la config legacy de la vue principale.
- **Base = annonces en ligne exclusivement** : pas de filtre `status` côté API → on garde le
  filtre client `OFFLINE_STATUSES` ; côté pull on utilise `fromDate`/`fromUpdatedAt`.

## ⚠️ Points À VALIDER avant le Lot 3 (webhooks)

1. **Facturation des webhooks/events** : absente de la doc publique. Confirmer avec le support
   Stream Estate : facturé par event reçu ? par item tiré du `match` ? par saved-search ?
   → conditionne l'unité suivie par le dashboard. Le CDC suit **items ET events** par sécurité.
2. **Réception webhook en prod** : l'API n'émet que depuis des IP fixes (prod `144.76.91.183`,
   sandbox `178.238.226.136`). Vercel n'autorise pas d'allowlist IP entrante simple → protection
   par **secret partagé** + vérif IP best-effort. À confirmer que SE accepte un secret en
   query/header sur l'`eventEndpoint`.
3. **URL publique stable** pour `endpointRecipient`/`eventEndpoint` (pas une preview éphémère).

## API Stream Estate (confirmé par la doc)

- **Saved search** `POST /searches` : `includedZipcodes`, `includedZipcodesInsee`,
  `propertyTypes`, `transactionType` (0=vente), `budgetMin/Max`… +
  `endpointRecipient` (matchs de biens) + `eventEndpoint` + `subscribedEvents` +
  `notificationEnabled`.
- **6 events** : `property.ad.create` (nouvelle annonce = push), `ad.update.price`,
  `ad.update.surface`, `ad.update.pictures`, `ad.update.expired`, `property.ad.update`.
- **Payload webhook** : `event` (type) + `adEvent` (ancien/nouveau, % variation) + `match`
  (document complet du bien).
- **Sécurité** : retries 5× à 1h d'intervalle, attend un HTTP 200.
- **Pull incrémental** : `fromDate` (créés depuis), `fromUpdatedAt` (modifiés depuis),
  `eventPriceVariationFromCreatedAt`, `itemsPerPage` (max 30, `0` = comptage gratuit).
- **Pas de filtre `status/online`** côté API → « en ligne » reste un filtre client.

## Mapping events → pipeline

| Event Stream Estate  | Effet pipeline                                                  |
|----------------------|----------------------------------------------------------------|
| `property.ad.create` | upsert + notif `new_listing` + matching acheteur               |
| `ad.update.price`    | `property_price_history` + notif baisse de prix                |
| `ad.update.expired`  | `market_properties.status='expired'` (sort de la liste chaude) |
| `ad.update.surface`  | maj champ + re-score                                           |
| `ad.update.pictures` | maj `raw_json` (faible priorité)                               |
| `property.ad.update` | maj générique + re-score                                       |

## Découpage en lots

### Lot 1 — Dashboard épuré + sync manuelle illimitée (aucune dépendance externe)
- `src/app/admin/market/settings/page.tsx` : 3 blocs (Conso J+M, Réglages sync & budget,
  Historique). Retrait « Fraîcheur par zone » + config legacy.
- `src/lib/stream-estate-budget.ts` : réglage **illimité** (`stream_estate_unlimited_items`,
  clé `app_settings`, schemaless → pas de migration). En illimité, le plafond items = budget
  disponible (pas le `max_items_per_sync`).
- `src/app/api/market/sync/route.ts` + `sync-preview/route.ts` : respect de l'illimité.
- `src/app/api/market/sync-stats/route.ts` : expose `unlimited_items` au dashboard.
- Sync illimitée → l'aperçu (comptage gratuit `itemsPerPage=0`) montre total + coût avant
  confirmation.

### Lot 2 — Cadence en jours + pull incrémental
- Migration `app_settings` : `monitoring_recheck_days_*` (or/chaud/tiède/froid),
  `stream_estate_reconcile_window_days`. Conserver les clés `*_hours_*` en lecture (migration douce).
- `src/lib/settings.ts` + `src/lib/market/lead-monitor.ts` : comparaisons en jours.
- `src/lib/stream-estate.ts` : params `fromUpdatedAt`/`fromDate` sur `fetchOnePage`/`fetchListings`.
- `src/app/api/jobs/sync-zones/route.ts` : la « découverte » devient un pull incrémental
  `fromUpdatedAt` cadencé en jours (garde-fous budget + `STREAM_ESTATE_CRON_ENABLED` conservés).

### Lot 3 — Webhooks (après validation des points À VALIDER)
- `src/app/api/market/webhooks/stream-estate/route.ts` (POST public, secret + IP best-effort).
- `src/lib/market/upsert-listing.ts` : service partagé extrait de `sync/route.ts` (upsert +
  notifications), réutilisé par sync ET webhook.
- `src/lib/stream-estate.ts` : `createSavedSearch()` / `listSavedSearches()` / `deleteSavedSearch()`.
- Migration `014_stream_estate_webhooks.sql` : `monitored_zones.stream_estate_search_id`,
  `stream_estate_usage_events.source` + `event_type`, `sync_runs.source`,
  clés `app_settings` (`stream_estate_webhook_enabled`…). Régénérer `src/types/supabase.ts`.
- `src/lib/stream-estate-budget.ts` : exposer `eventsToday/Month/Total` (budget multi-unités).
- Env : `STREAM_ESTATE_WEBHOOK_SECRET`, `STREAM_ESTATE_PUBLIC_BASE_URL`.

### Lot 4 — Qualité des annonces importées (fait)

Constat sur les données réelles (Pontevès, 7 biens) : **6 fiches sur 7 pointaient vers une
annonce morte ou n'existaient plus sur le marché**, et aucune n'avait de pièces, chambres,
DPE, GES ni terrain.

Quatre causes, quatre correctifs dans `src/lib/stream-estate.ts` :

1. **`adverts[0]` pris en aveugle.** Une propriété porte N diffusions (leboncoin, seloger…),
   chacune avec son `expired`, son prix et son URL. `pickReferenceAdvert()` retient désormais
   une annonce **en ligne**, en priorisant les portails (`PORTAL_PRIORITY` : leboncoin d'abord),
   puis le crawl le plus récent. Les autres diffusions alimentent `market_property_sources`.
2. **`expired = false` ne veut pas dire « en ligne ».** Le flag n'est posé que si Stream Estate
   *constate* le retrait ; une annonce que le crawler a perdue de vue reste `false` pour
   toujours (cas réels : dernier crawl en 2023, en 2024). `evaluateListingQuality()` juge sur
   **`lastCrawledAt` des annonces encore en ligne**, seuil `stream_estate_max_crawl_age_days`
   (défaut 90 j). Écarte aussi : prix incohérent (`coherentPrice`), prix nul, URL absente,
   surface absente, bien hors zone.
3. **Type de vendeur décidé par l'ordre des annonces.** `sellerTypeFromAdverts()` agrège sur les
   diffusions en ligne — une seule annonce PAP vivante qualifie le bien en PAP. Le contact prime
   sur `publisher.type`, qui décrit le flux du portail et non le vendeur.
4. **Champs jamais mappés.** Le payload expose `room`, `bedroom`, `energy.category`,
   `greenHouseGas.category` ; le code lisait `roomsCount`, `dpeValue`. Corrigé, avec repli sur
   l'annonce de référence quand le niveau bien est vide (`landSurface` notamment).

Deux compléments hors normalisation :

- **Réconciliation** (`reconcileZoneListings`, `src/app/api/market/sync/route.ts`) : après un
  balayage exhaustif (non tronqué, non incrémental), les biens de la zone non revus passent en
  `expired`. C'est le seul signal de « vendu/retiré » exploitable — l'API n'expose aucun statut
  de vente. Rien n'est supprimé : l'historique de prix sert aux statistiques de marché.
  `/api/market/properties` masque par défaut les statuts hors marché (`status=all` pour les voir).
- **Reprise de l'existant** : `POST /api/market/sync/repair` (`{ "dry_run": true }` pour un diff
  à blanc) recalcule les biens déjà en base depuis leur `raw_json`. Gratuit — aucun item facturé.

### Lot 5 — Biens en agence (fait)

Objectif : repérer les **mandats qui traînent** pour aller chercher les vendeurs prêts à
changer d'agence. Le `mandate_score` sert déjà ce besoin sans modification — il note temps en
ligne, baisses de prix, intensité et republication, sans regarder le type de vendeur. Un bien
en agence depuis 300 jours avec 3 baisses ressort en `golden` tout seul.

- `publisherTypes` était plumbé dans la lib mais **jamais transmis** par les routes : figé sur
  `[0]` (PAP). `sync` et `sync-preview` le lisent désormais du body (`publisher_types`), défaut
  `[0]`. Sélecteur « Qui vend » dans l'écran d'import ; le comptage gratuit est relancé à chaque
  changement, donc le coût affiché correspond toujours au périmètre validé.
- **Ordres de grandeur mesurés sur Pontevès (83670)** : 15 biens PAP en ligne (0,15 €) contre
  164 avec les agences (1,64 €) — ×11. D'où le défaut PAP et le choix explicite à l'import.
- **Cadrage de la réconciliation** (correctif de fond) : un import ne prouve rien hors de son
  périmètre. Scanner « maisons PAP » ne dit rien des appartements ni des biens en agence, qui
  doivent rester intacts. `reconcileZoneListings` filtre donc sur `property_type` et, quand un
  seul type d'annonceur est scanné, sur `seller_type` (`seller_type` nul = jamais touché).
  Ce défaut existait déjà pour les types de biens.
- **Notifications** : à 10 biens en agence pour 1 PAP, tout notifier noierait les vrais signaux.
  Un bien en agence n'est notifié qu'au-delà de `AGENCY_NOTIFY_MIN_DAYS` (90 j, palier haut de
  l'axe Temps du score), sous le titre « Mandat qui traîne ». Les PAP restent notifiés en
  priorité haute dès leur parution. Tous les biens restent classés par le `mandate_score`.

### Lot 6 — Ne plus payer le cimetière (fait)

**Constat.** Le devis d'import annonçait 164 biens « en ligne » sur Pontevès (~700 habitants).
Comptages gratuits sur quatre communes, `expired=false` contre « modifiés < 90 j » :

| Commune | `expired=false` | modifiés < 90 j | fantômes |
|-----------|-----------------|-----------------|----------|
| Pontevès  |   164 |  20 | 88 % |
| Barjols   | 1 699 | 109 | 94 % |
| Cotignac  | 4 274 | 348 | 92 % |
| Brignoles | 9 062 | 951 | 90 % |

Le `expired=false` de l'API souffre du même défaut que celui corrigé au Lot 4, mais côté
serveur : il compte tout ce que Stream Estate n'a jamais *constaté* retiré. On facturait donc
90 % de déchet, écarté ensuite par le filtre de fraîcheur.

**Correctif.** `fromUpdatedAt` est le **seul** filtre serveur exploitable — sept autres noms de
paramètres ont été testés (`fromLastCrawledAt`, `lastCrawledAt[after]`…), tous **silencieusement
ignorés** : cette API ne rejette pas un paramètre inconnu, elle renvoie tout. `toUpdatedAt`
existe également (borne haute, vérifiée).

Fenêtre par défaut **180 jours** (`stream_estate_import_window_days`), appliquée à l'import
**et** au devis. Validée par échantillon : 30 biens tirés de la bande écartée (contenu figé
depuis 180 à 365 j) → **30/30 avaient aussi cessé d'être crawlés**, zéro annonce vivante perdue.

L'aperçu affiche maintenant les deux nombres : « 26 annonces facturées → environ 20 biens
retenus », plus le volume évité. Pontevès passe de 1,64 € à 0,26 €, Brignoles de 90,62 € à
14,92 €. La fenêtre par défaut ne désactive pas la réconciliation (un bien inchangé depuis plus
de 180 j n'est plus crawlé non plus) ; une fenêtre *imposée par l'appelant* — le cron
incrémental — la désactive toujours.

**Repli code postal condamné.** `includedZipcodes[]` déborde massivement de la commune :
4 140 biens sur le CP 83670 contre 164 sur l'INSEE 83095 (×25), et 9 718 sur 75001, soit tout
Paris. `appendGeoFilter` y basculait dès qu'une zone n'avait pas d'INSEE — en mode illimité,
budget vidé sur une zone. L'INSEE est désormais obligatoire (`StreamEstateGeoTargetError`),
contrôlé **avant** toute écriture pour qu'un import refusé ne laisse pas de zone fantôme.

Corrigé au passage : `fetchListings` faisait varier `itemsPerPage` en cours de pagination
(décalage des pages suivantes, doublons et trous) et sous-comptait les items facturés, puisqu'il
ne comptait que les biens conservés après filtrage.

## Vérification

- **Lot 1** : `/admin/market/settings` → 3 blocs ; activer « Illimité », lancer une sync depuis
  `/admin/market/zones` → aperçu total + coût avant confirmation ; KPI J/M et `sync_runs` à jour.
- **Lot 2** : cadence en jours respectée par `lead-monitor` (logs cron `?test=1`) ; pull
  `fromUpdatedAt` ne tire que le modifié.
- **Lot 3** : saved search sandbox → POST signé sur `/api/market/webhooks/stream-estate` →
  upsert + notif + `stream_estate_usage_events` source=`webhook` ; rejet sans secret (401).
- **Lot 4** : `npx vitest run src/lib/__tests__/stream-estate-listings.test.ts` (fixtures
  calquées sur des documents réels) ; puis `POST /api/market/sync/repair` en `dry_run` →
  vérifier le diff URL/prix/vendeur avant d'appliquer.
- Build/lint : `npm run build` puis `npm run lint`. Pas de push `origin/preview` sans accord d'Alexandre.
