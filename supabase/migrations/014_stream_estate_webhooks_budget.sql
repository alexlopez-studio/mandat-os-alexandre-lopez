-- Migration 014 — Stream Estate webhooks + budget mensuel
--
-- Objectif :
--   - rattacher une saved search Stream Estate aux communes surveillées ;
--   - distinguer les sources de consommation (manuel, reconcile, webhook, monitoring) ;
--   - compter les events webhook même si leur coût fournisseur reste à confirmer ;
--   - ajouter un plafond mensuel de sécurité.

alter table public.monitored_zones
  add column if not exists stream_estate_search_id text,
  add column if not exists last_reconciled_at timestamptz;

alter table public.sync_runs
  add column if not exists source text not null default 'manual';

alter table public.stream_estate_usage_events
  add column if not exists source text not null default 'manual',
  add column if not exists event_type text;

create index if not exists idx_monitored_zones_stream_estate_search_id
  on public.monitored_zones(stream_estate_search_id);

create index if not exists idx_stream_estate_usage_events_source_created_at
  on public.stream_estate_usage_events(source, created_at desc);

create index if not exists idx_stream_estate_usage_events_event_type_created_at
  on public.stream_estate_usage_events(event_type, created_at desc);

insert into public.app_settings (key, value)
values
  ('stream_estate_monthly_budget_eur', '0'::jsonb),
  ('stream_estate_webhook_enabled', 'false'::jsonb),
  ('stream_estate_webhook_event_cost_eur', '0'::jsonb),
  ('stream_estate_reconcile_window_days', '1'::jsonb)
on conflict (key) do nothing;

comment on column public.monitored_zones.stream_estate_search_id is 'Identifiant de la saved search Stream Estate associée à la commune.';
comment on column public.monitored_zones.last_reconciled_at is 'Dernier pull incrémental de sécurité réussi pour cette zone.';
comment on column public.sync_runs.source is 'Origine du run Stream Estate : manual, reconcile, webhook ou monitoring.';
comment on column public.stream_estate_usage_events.source is 'Origine de la consommation Stream Estate : manual, reconcile, webhook ou monitoring.';
comment on column public.stream_estate_usage_events.event_type is 'Type event Stream Estate pour les webhooks et le monitoring.';
