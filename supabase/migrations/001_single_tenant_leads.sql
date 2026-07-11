-- =============================================================
-- Schema Supabase — site-alex-lopez-provence
-- Architecture single-tenant (pas de multi-tenant)
-- Table unique : leads
-- =============================================================

create extension if not exists "pgcrypto";

-- Table leads
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('vendre', 'acheter', 'audit')),
  prenom           text,
  nom              text,
  email            text not null,
  telephone        text,
  form_data        jsonb,                        -- données brutes du formulaire
  results          jsonb,                        -- résultats calculés (estimation / audit)
  token            uuid unique not null default gen_random_uuid(), -- magic link prospect + accès admin
  attio_record_id  text,                         -- ID de la fiche dans Attio
  opt_in           boolean not null default false,
  opt_in_date      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index
create index if not exists leads_email_idx   on leads (email);
create index if not exists leads_type_idx    on leads (type);
create index if not exists leads_token_idx   on leads (token);
create index if not exists leads_created_idx on leads (created_at desc);

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- Row Level Security
-- Note : accès via service_role uniquement (pas d'accès public direct)
alter table leads enable row level security;

-- Politique : service_role bypass automatique (pas besoin de policy explicite)
-- Les API routes utilisent supabaseAdmin (service_role key) pour toutes les opérations
