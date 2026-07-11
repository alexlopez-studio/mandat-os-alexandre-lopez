-- Migration 010 — Stream Estate items budget
--
-- Objectif :
--   - tracer le nombre d'items consommés par synchronisation ;
--   - garder la compatibilité avec les colonnes historiques basées sur les appels ;
--   - préparer les écrans à une logique de plafond d'items plutôt que d'appels.

alter table public.sync_runs
  add column if not exists external_item_count integer not null default 0;

alter table public.stream_estate_usage_events
  add column if not exists item_count integer not null default 0;

comment on column public.sync_runs.external_item_count is 'Nombre d items Stream Estate consommés pendant la synchronisation.';
comment on column public.stream_estate_usage_events.item_count is 'Nombre d items Stream Estate consommés pour cet événement de synchronisation.';
