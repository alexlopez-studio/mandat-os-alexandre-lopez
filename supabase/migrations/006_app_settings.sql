-- =============================================================
-- Migration 006 — App Settings
-- Table générique de paramètres clé/valeur pour le backoffice.
--
-- Premier usage : interrupteur du pipeline MandatFinder
-- (import Stream Estate + scoring) pour permettre de couper
-- les appels à l'API Stream Estate sans toucher au code/cron.
-- =============================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Valeur par défaut : pipeline activé (cohérent avec le cron existant)
insert into public.app_settings (key, value)
values ('mandatfinder_pipeline_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- ── Row Level Security ──────────────────────────────────────
alter table public.app_settings enable row level security;

-- Accès via service_role uniquement (pas d'accès public direct)
-- Les policies par défaut suffisent : service_role bypass RLS.

comment on table public.app_settings is 'Paramètres clé/valeur du backoffice (toggles, configuration runtime).';
comment on column public.app_settings.key is 'Identifiant unique du paramètre, ex: mandatfinder_pipeline_enabled.';
comment on column public.app_settings.value is 'Valeur JSON du paramètre (booléen, nombre, objet...).';
