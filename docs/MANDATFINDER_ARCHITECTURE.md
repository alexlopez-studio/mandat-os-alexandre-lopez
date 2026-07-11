# MandatFinder — Architecture DDD (Domain Driven Design)

## Vision produit

> Prédire la probabilité qu'un propriétaire accepte un rendez-vous ou un mandat
> à partir des signaux publics de son annonce immobilière.

## Principes fondateurs

1. **L'événement est l'actif principal** — chaque modification d'annonce (prix, statut) est un événement.
2. **Le snapshot est la mémoire** — on archive l'état complet de chaque annonce chaque jour.
3. **Le score est contextuel** — il dépend du temps, du comportement, du prix, et à terme du DVF.
4. **L'architecture est compatible** — Next.js 15, Supabase/PostgreSQL, Vercel, TypeScript, DeepSeek.

---

## Arborescence du projet

```
src/
├── lib/
│   ├── mandat/                          ← Module MandatFinder (DDD)
│   │   ├── types.ts                     ← Domain types (Listing, Event, Score, etc.)
│   │   ├── import-service.ts            ← Ingestion Stream Estate → listings
│   │   ├── history-service.ts           ← Snapshots quotidiens + historique prix
│   │   ├── event-service.ts             ← Détection d'événements (price_drop, relisted...)
│   │   ├── scoring-service.ts           ← Calcul du MandateProbabilityScore
│   │   ├── analysis-service.ts          ← Analyse batch quotidienne
│   │   ├── radar-queries.ts             ← Requêtes pour le dashboard Radar
│   │   └── dvf-enricher.ts              ← V2 : enrichissement DVF / prix au m²
│   │
│   ├── stream-estate.ts                 ← Existant : client API Stream Estate
│   └── market/
│       └── matching-engine.ts           ← Existant : matching acheteur/vendeur
│
├── app/
│   ├── api/
│   │   ├── jobs/
│   │   │   ├── import-stream-estate/    ← Cron : import quotidien des annonces
│   │   │   │   └── route.ts
│   │   │   ├── market/
│   │   │   │   ├── sync-preview/         ← Préflight Stream Estate (budget + totalItems)
│   │   │   │   └── sync/                ← Sync contrôlée par CP + plafond max_items
│   │   │   └── analyze-listings/        ← Cron : analyse + scoring quotidien
│   │   │       └── route.ts
│   │   └── radar/
│   │       └── listings/                ← API : requêtes radar filtrées
│   │           └── route.ts
│   │
│   └── dashboard/
│       └── radar/                       ← Page Radar MandatFinder
│           ├── page.tsx
│           └── _components/
│               ├── RadarKPIs.tsx
│               ├── RadarFilters.tsx
│               ├── RadarTable.tsx
│               └── SellerPhaseBadge.tsx
│
├── supabase/
│   └── migrations/
│       ├── 001_single_tenant_leads.sql  ← Existant (legacy)
│       ├── 002_phase_b_schema.sql       ← Existant (prospects, leads, events)
│       ├── 003_seed_rules.sql           ← Existant (management_rules)
│       ├── 004_matching_schema.sql      ← Existant (matching)
│       └── 005_mandatfinder_core.sql    ← NOUVEAU : listings, snapshots, events, scores
```

---

## Responsabilités des modules

### 1. `types.ts` — Types du domaine MandatFinder

```typescript
// Entités principales
Listing            → Annonce telle qu'importée de Stream Estate
ListingSnapshot    → État complet d'une annonce à une date donnée (historique)
ListingEvent       → Événement détecté (price_drop, relisted, expired, etc.)
SellerScore        → Score calculé pour un vendeur (daily)
MandateProbability → Résultat du scoring (0-100) + breakdown par axe
```

| Champ | Description |
|-------|-------------|
| `externalId` | ID unique Stream Estate |
| `status` | active, removed, expired, relisted |
| `currentPrice` | Dernier prix connu |
| `firstSeenAt` | Date de première détection |
| `lastSeenAt` | Date de dernière mise à jour |
| `daysOnline` | Nombre de jours en ligne |
| `priceDrops` | Nombre de baisses de prix |
| `priceDropPercent` | Pourcentage total de baisse |
| `lastEvent` | Dernier événement détecté |

### 2. `import-service.ts` — Ingestion

| Responsabilité | Détail |
|---------------|--------|
| Importer | Appelle `stream-estate.fetchListings()` pour chaque CP avec plafond `max_items` |
| Upsert | Insère ou met à jour la table `listings` |
| Préparer snapshot | Copie l'état dans `listing_snapshots` si le prix ou le statut change |
| Logger | Enregistre les résultats de l'import (nouvelles, mises à jour, erreurs) |
| Préflight | Utilise `stream-estate.previewListings()` avant la sync pour estimer `hydra:totalItems` et le coût |

**Dépendances** : `stream-estate.ts`, `supabase.ts`
**Déclencheur** : Cron `/api/jobs/import-stream-estate`

### 3. `history-service.ts` — Historisation

| Responsabilité | Détail |
|---------------|--------|
| Snapshot quotidien | Pour chaque listing actif, archive l'état complet dans `listing_snapshots` |
| Historique prix | Extrait la courbe des prix à partir des snapshots |
| Détection changement | Compare dernier snapshot vs avant-dernier pour détecter les mutations |

**Principe** : on snapshot **tous les jours** les listings actifs. Cela permet de reconstruire l'historique des prix, de détecter les baisses, les stagnations, etc.

### 4. `event-service.ts` — Détection d'événements

| Événement | Déclencheur | Signal |
|-----------|------------|--------|
| `PRICE_DROP` | Prix différent entre snapshot J-1 et J | 😤 Frustration |
| `PRICE_INCREASE` | Prix qui remonte (rare) | ⚠️ Anomalie |
| `LISTING_REMOVED` | Annonce disparue de l'API | 🔄 Republication possible |
| `LISTING_RELISTED` | Même bien, nouveau prix, nouveau statut | 🔥 Très fort signal |
| `STAGNATION_90` | 90+ jours sans baisse ni modification | ⏱ Fenêtre d'or |
| `OVERPRICED` | Prix > 15% au-dessus du DVF (V2) | 📉 Surcote |

**Principe** : après chaque snapshot, on compare les états et on insère les événements dans `listing_events`.

### 5. `scoring-service.ts` — Scoring vendeur

**Modèle V1** : MandateProbabilityScore sur 100 (4 axes)

| Axe | Poids | Calcul |
|-----|-------|--------|
| ⏱ **Temps** | 40 pts | Ancienneté : 0-30j=5, 31-60j=15, 61-90j=30, 90-120j=35, 120+j=40 |
| 😤 **Frustration** | 30 pts | Baisses : 0=0, 1=10, 2=20, 3+=30 |
| 📉 **Intensité baisse** | 15 pts | % : 0-3%=0, 3-5%=5, 5-10%=10, 10%+=15 |
| 🔄 **Comportement** | 15 pts | Republication : oui=10, +nouveau prix=15 |

**Modèle V2** (quand DVF sera intégré) :

| Axe | Poids | Source |
|-----|-------|--------|
| ⏱ **Temps** | 25% | Stream Estate |
| 📊 **Prix / DVF** | 35% | DVF + Cadastre |
| 😤 **Comportement** | 25% | Historique prix + événements |
| 🔄 **Annonce** | 15% | Republications, expirations |

**Résultat** : `MandateProbabilityScore { score: 0-100, breakdown: { time, frustration, dropIntensity, behavior }, phase: 'cold'|'warm'|'hot'|'golden' }`

### 6. `analysis-service.ts` — Analyse batch

| Responsabilité | Détail |
|---------------|--------|
| Orchestrer | 1. Importer → 2. Snapshoter → 3. Événementiser → 4. Scorer |
| Regrouper par CP | Traiter les CP configurés les uns après les autres |
| Notifier | Déclencher les alertes si des scores dépassent des seuils |
| Logger | Stocker le résultat du batch (duration, count, errors) |

**Déclencheur** : Cron `/api/jobs/analyze-listings`
**Fréquence** : Quotidienne (la nuit)

### 7. `radar-queries.ts` — Requêtes Radar

| Requête | Usage |
|---------|-------|
| `getHotListings()` | Score > 70 = fenêtre d'or |
| `getPriceDrops()` | Vendeurs ayant baissé leur prix cette semaine |
| `getRemovedListings()` | Annonces retirées récemment |
| `getStaleListings()` | 90+ jours en ligne |
| `getRelistedListings()` | Annonces republiées |
| `getFilteredListings(filters)` | Filtres combinés (CP, score min, type, etc.) |

### 8. `dvf-enricher.ts` — V2 : Enrichissement DVF

| Responsabilité | Détail |
|---------------|--------|
| Prix au m² | Calcule le prix/m² de l'annonce |
| Référentiel | Compare au prix/m² médian DVF de la commune |
| Surcote | Détecte les biens surcotés de plus de 15% |
| Sous-cote | Détecte les biens sous-évalués |

---

## Flux de données

```
Stream Estate API
     │
     ▼
[ImportService]  (cron quotidien)
     │
     ├─→ listings (table)          ← Upsert des annonces
     │
     ▼
[HistoryService]  (après chaque import)
     │
     ├─→ listing_snapshots (table) ← Archive état quotidien
     │
     ▼
[EventService]  (comparaison snapshots)
     │
     ├─→ listing_events (table)    ← PriceDrop, Relisted, Removed...
     │
     ▼
[ScoringService]  (après chaque événement)
     │
     ├─→ seller_scores (table)     ← Score journalier par vendeur
     │
     ▼
[Radar Dashboard]  (affichage)
     │
     └─→ Vues filtrées par score, CP, type, phase...
```

---

## Tables Supabase (V1)

```
listings
  id UUID PK
  external_id TEXT UNIQUE          ← ID Stream Estate
  source TEXT DEFAULT 'stream_estate'
  title TEXT
  description TEXT
  city TEXT
  zipcode TEXT
  insee_code TEXT
  lat NUMERIC(10,7)
  lon NUMERIC(10,7)
  property_type TEXT
  price NUMERIC(12,2)
  surface NUMERIC(8,2)
  land_surface NUMERIC(8,2)
  rooms INT
  bedrooms INT
  dpe TEXT
  ges TEXT
  url TEXT
  images JSONB
  status TEXT                      ← active, removed, expired, relisted
  first_seen_at TIMESTAMPTZ
  last_seen_at TIMESTAMPTZ
  raw JSONB
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

listing_snapshots
  id UUID PK
  listing_id UUID FK → listings
  price NUMERIC(12,2)
  status TEXT
  surface NUMERIC(8,2)
  raw JSONB                         ← État complet au moment du snapshot
  snapshotted_at TIMESTAMPTZ        ← Date du snapshot

listing_events
  id UUID PK
  listing_id UUID FK → listings
  event_type TEXT                   ← price_drop, price_increase, removed, relisted, stagnation_90, overpriced
  previous_price NUMERIC(12,2)
  new_price NUMERIC(12,2)
  drop_percent NUMERIC(5,2)
  metadata JSONB
  detected_at TIMESTAMPTZ

seller_scores
  id UUID PK
  listing_id UUID FK → listings
  score INT CHECK (0-100)
  time_score INT
  frustration_score INT
  drop_intensity_score INT
  behavior_score INT
  phase TEXT                        ← cold, warm, hot, golden
  breakdown JSONB
  calculated_at TIMESTAMPTZ
```

---

## Roadmap V1 → V2

| Version | Features |
|---------|----------|
| **V1** | Import Stream Estate, snapshots, événements (price_drop, removed, relisted), scoring 4 axes (100pts), Dashboard Radar, CRONS quotidiens |
| **V2** | DVF (prix/m² référentiel), surcote/décote dans le scoring, Cadastre, PLU, multi-utilisateurs, notifications Telegram |
| **V3** | CRM intégré, IA DeepSeek pour recommandations, prédiction de mandat |

---

## Contraintes techniques

- **Stack** : Next.js 15, Supabase (PostgreSQL), TypeScript, Vercel
- **CRONS** : Vercel Cron Jobs (max 1 par jour pour le plan Hobby — les 2 jobs actuels sont déjà configurés)
- **Limitation** : 2 crons max sur le plan actuel → il faudra mutualiser import + analyse dans un seul cron, ou passer en PRO
- **IA** : DeepSeek API pour les recommandations (V2/V3)
- **État** : Single-tenant (pas de multi-utilisateurs pour l'instant)
