-- Migration 009 — Stream Estate budget guardrails
--
-- Objectif :
--   - tracer chaque appel payant estime vers Stream Estate ;
--   - enrichir sync_runs avec appels externes, cout estime et raison de blocage ;
--   - stocker les garde-fous budget dans app_settings.

alter table public.sync_runs
  add column if not exists external_request_count integer not null default 0,
  add column if not exists estimated_cost_eur numeric(10, 4) not null default 0,
  add column if not exists blocked_reason text;

create table if not exists public.stream_estate_usage_events (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid references public.sync_runs(id) on delete set null,
  zipcode text not null,
  endpoint text not null,
  page integer not null,
  request_status text not null check (request_status in ('success', 'error')),
  estimated_cost_eur numeric(10, 4) not null default 0,
  started_at timestamptz not null,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stream_estate_usage_events_sync_run_id
  on public.stream_estate_usage_events(sync_run_id);

create index if not exists idx_stream_estate_usage_events_zipcode_created_at
  on public.stream_estate_usage_events(zipcode, created_at desc);

alter table public.stream_estate_usage_events enable row level security;

insert into public.app_settings (key, value)
values
  ('stream_estate_sync_enabled', 'false'::jsonb),
  ('stream_estate_manual_balance_eur', '0'::jsonb),
  ('stream_estate_cost_per_request_eur', '0.01'::jsonb),
  ('stream_estate_max_requests_per_sync', '1'::jsonb),
  ('stream_estate_min_balance_eur', '0'::jsonb)
on conflict (key) do nothing;

comment on table public.stream_estate_usage_events is 'Journal des appels externes Stream Estate et de leur cout estime.';
comment on column public.sync_runs.external_request_count is 'Nombre d appels externes Stream Estate consommes pendant la synchronisation.';
comment on column public.sync_runs.estimated_cost_eur is 'Cout estime de la synchronisation en euros.';
comment on column public.sync_runs.blocked_reason is 'Raison de blocage budget/configuration si la synchronisation n a pas ete executee.';
