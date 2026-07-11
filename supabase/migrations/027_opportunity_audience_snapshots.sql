-- =============================================================
-- Migration 027 — Historique des statistiques de diffusion
-- Un relevé cumulatif par affaire, portail et date d'observation.
-- =============================================================

create table if not exists public.opportunity_audience_snapshots (
  id              uuid primary key default gen_random_uuid(),
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  portal          text not null,
  captured_on     date not null default current_date,
  views           integer not null default 0 check (views >= 0),
  contacts        integer not null default 0 check (contacts >= 0),
  favorites       integer not null default 0 check (favorites >= 0),
  visits          integer not null default 0 check (visits >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (opportunity_id, portal, captured_on)
);

create index if not exists opportunity_audience_snapshots_timeline_idx
  on public.opportunity_audience_snapshots (opportunity_id, captured_on desc, portal);

drop trigger if exists opportunity_audience_snapshots_updated_at
  on public.opportunity_audience_snapshots;
create trigger opportunity_audience_snapshots_updated_at
  before update on public.opportunity_audience_snapshots
  for each row execute function public.set_updated_at();

alter table public.opportunity_audience_snapshots enable row level security;

comment on table public.opportunity_audience_snapshots is
  'Releves cumulatifs dates des vues, contacts, favoris et visites par portail pour une affaire vendeur.';
