-- =============================================================
-- Migration 005 — MandatFinder Core
-- Tables de base pour le moteur de détection d'opportunités
--
-- Tables créées :
--   listings               ← Annonces importées (Stream Estate)
--   listing_snapshots      ← Historique quotidien des états
--   listing_events         ← Événements détectés (price_drop, relisted...)
--   seller_scores          ← Scores quotidiens par vendeur
-- =============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Types ENUM ──────────────────────────────────────────────
do $$ begin
  create type public.listing_status as enum (
    'active',
    'removed',
    'expired',
    'relisted'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.listing_event_type as enum (
    'price_drop',
    'price_increase',
    'listing_removed',
    'listing_relisted',
    'stagnation_90',
    'overpriced',
    'first_seen'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.seller_phase as enum (
    'cold',
    'warm',
    'hot',
    'golden'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 1. Table: listings
--    Stocke les annonces telles qu'importées de Stream Estate
-- ============================================================
create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  external_id     text not null,
  source          text not null default 'stream_estate',
  title           text,
  description     text,
  city            text,
  zipcode         text,
  insee_code      text,
  lat             numeric(10,7),
  lon             numeric(10,7),
  property_type   text,
  price           numeric(12,2),
  surface         numeric(8,2),
  land_surface    numeric(8,2),
  rooms           integer,
  bedrooms        integer,
  dpe             text,
  ges             text,
  url             text,
  images          jsonb default '[]'::jsonb,
  status          public.listing_status not null default 'active',
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  raw             jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Contrainte : external_id unique par source
create unique index if not exists listings_external_id_source_idx
  on public.listings (external_id, source);

-- Index de recherche
create index if not exists listings_zipcode_idx     on public.listings (zipcode);
create index if not exists listings_status_idx      on public.listings (status);
create index if not exists listings_city_idx        on public.listings (city);
create index if not exists listings_price_idx       on public.listings (price);
create index if not exists listings_property_type_idx on public.listings (property_type);
create index if not exists listings_first_seen_idx  on public.listings (first_seen_at desc);
create index if not exists listings_last_seen_idx   on public.listings (last_seen_at desc);

-- Trigger updated_at
create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Table: listing_snapshots
--    Archive quotidienne de l'état complet d'une annonce
-- ============================================================
create table if not exists public.listing_snapshots (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  price           numeric(12,2),
  status          public.listing_status,
  surface         numeric(8,2),
  raw             jsonb default '{}'::jsonb,
  snapshotted_at  timestamptz not null default now()
);

-- Un seul snapshot par listing et par jour (prévention doublons batch)
create unique index if not exists listing_snapshots_listing_date_idx
  on public.listing_snapshots (listing_id, (snapshotted_at::date));

-- Index de recherche chronologique
create index if not exists listing_snapshots_listing_id_idx
  on public.listing_snapshots (listing_id, snapshotted_at desc);

create index if not exists listing_snapshots_date_idx
  on public.listing_snapshots (snapshotted_at desc);

-- ============================================================
-- 3. Table: listing_events
--    Événements détectés par comparaison des snapshots
-- ============================================================
create table if not exists public.listing_events (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  event_type      public.listing_event_type not null,
  previous_price  numeric(12,2),
  new_price       numeric(12,2),
  drop_percent    numeric(5,2),
  snapshot_id     uuid references public.listing_snapshots(id) on delete set null,
  metadata        jsonb default '{}'::jsonb,
  detected_at     timestamptz not null default now()
);

create index if not exists listing_events_listing_id_idx
  on public.listing_events (listing_id, detected_at desc);

create index if not exists listing_events_type_idx
  on public.listing_events (event_type);

create index if not exists listing_events_detected_at_idx
  on public.listing_events (detected_at desc);

-- ============================================================
-- 4. Table: seller_scores
--    Score quotidien MandateProbability par annonce/vendeur
-- ============================================================
create table if not exists public.seller_scores (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references public.listings(id) on delete cascade,
  score                 integer not null check (score >= 0 and score <= 100),
  time_score            integer not null default 0,
  frustration_score     integer not null default 0,
  drop_intensity_score  integer not null default 0,
  behavior_score        integer not null default 0,
  phase                 public.seller_phase not null default 'cold',
  breakdown             jsonb default '{}'::jsonb,
  calculated_at         timestamptz not null default now()
);

-- Un seul score par listing et par jour
create unique index if not exists seller_scores_listing_date_idx
  on public.seller_scores (listing_id, (calculated_at::date));

-- Index de recherche pour le radar
create index if not exists seller_scores_score_idx
  on public.seller_scores (score desc);

create index if not exists seller_scores_phase_idx
  on public.seller_scores (phase);

create index if not exists seller_scores_calculated_at_idx
  on public.seller_scores (calculated_at desc);

-- ============================================================
-- 5. Row Level Security
-- ============================================================
alter table public.listings          enable row level security;
alter table public.listing_snapshots enable row level security;
alter table public.listing_events    enable row level security;
alter table public.seller_scores     enable row level security;

-- Accès via service_role uniquement (pas d'accès public direct)
-- Les policies par défaut suffisent : service_role bypass RLS.

-- ============================================================
-- 6. Comments
-- ============================================================
comment on table public.listings is 'Annonces importées de Stream Estate. 1 ligne = 1 bien unique (external_id + source).';
comment on table public.listing_snapshots is 'Archive quotidienne de l''état complet d''une annonce. Permet de reconstruire l''historique des prix.';
comment on table public.listing_events is 'Événements détectés : baisse de prix, republication, retrait, stagnation. Actif principal du scoring.';
comment on table public.seller_scores is 'Score MandateProbability quotidien (0-100) par annonce. Alimente le Radar MandatFinder.';