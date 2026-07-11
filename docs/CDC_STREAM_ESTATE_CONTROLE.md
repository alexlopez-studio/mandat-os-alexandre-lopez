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

## Vérification

- **Lot 1** : `/admin/market/settings` → 3 blocs ; activer « Illimité », lancer une sync depuis
  `/admin/market/zones` → aperçu total + coût avant confirmation ; KPI J/M et `sync_runs` à jour.
- **Lot 2** : cadence en jours respectée par `lead-monitor` (logs cron `?test=1`) ; pull
  `fromUpdatedAt` ne tire que le modifié.
- **Lot 3** : saved search sandbox → POST signé sur `/api/market/webhooks/stream-estate` →
  upsert + notif + `stream_estate_usage_events` source=`webhook` ; rejet sans secret (401).
- Build/lint : `npm run build` puis `npm run lint`. Pas de push `origin/preview` sans accord d'Alexandre.
