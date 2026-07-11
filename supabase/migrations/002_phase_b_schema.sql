-- =============================================================
-- Phase B MVP v1 — Schéma initial (3 mai 2026)
-- Pivot du 29 avril → 3 mai : Notion-only abandonné, retour Supabase + dashboard admin custom.
-- Tables : prospects, leads (refondu), lead_events, admin_users
-- =============================================================

-- ============================================================
-- 1. Drop legacy (single-tenant `leads`)
-- ============================================================
drop trigger if exists leads_updated_at on public.leads;
drop table if exists public.leads cascade;
-- set_updated_at() function reused below (recreate to ensure idempotence)

-- ============================================================
-- 2. Extensions
-- ============================================================
create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ============================================================
-- 3. Helper: trigger updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 4. ENUMs
-- ============================================================
do $$ begin
  create type public.lead_tool as enum ('vendre', 'acheter', 'audit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_status as enum (
    'nouveau',
    'contacte',
    'r1',
    'mandat',
    'sous_compromis',
    'vendu',
    'perdu'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_event_kind as enum (
    'note',
    'status_change',
    'magic_link_resent',
    'rgpd_delete',
    'system'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 5. Table: prospects
-- ============================================================
create table public.prospects (
  id              uuid primary key default gen_random_uuid(),
  email           citext unique not null,
  first_name      text not null default '',
  last_name       text not null default '',
  phone           text,
  rgpd_consent_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index prospects_email_idx      on public.prospects (email);
create index prospects_created_at_idx on public.prospects (created_at desc);

create trigger prospects_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6. Table: leads (refondu)
-- ============================================================
create table public.leads (
  id                    uuid primary key default gen_random_uuid(),
  prospect_id           uuid not null references public.prospects(id) on delete cascade,
  tool                  public.lead_tool not null,
  status                public.lead_status not null default 'nouveau',
  form_data             jsonb not null default '{}'::jsonb,
  results               jsonb not null default '{}'::jsonb,
  commune               text,
  magic_link_expires_at timestamptz not null default (now() + interval '30 days'),
  magic_link_sent_at    timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index leads_prospect_id_idx on public.leads (prospect_id);
create index leads_tool_idx        on public.leads (tool);
create index leads_status_idx      on public.leads (status);
create index leads_created_at_idx  on public.leads (created_at desc);
create index leads_commune_idx     on public.leads (commune);
create index leads_active_idx      on public.leads (created_at desc) where deleted_at is null;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. Table: lead_events
-- ============================================================
create table public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  kind       public.lead_event_kind not null,
  payload    jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index lead_events_lead_id_idx on public.lead_events (lead_id, created_at desc);
create index lead_events_kind_idx    on public.lead_events (kind);

-- ============================================================
-- 8. Table: admin_users
-- ============================================================
create table public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      citext unique not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, is_active)
values ('alexlopez.studio@gmail.com', true)
on conflict (email) do nothing;

-- ============================================================
-- 9. Row Level Security
-- ============================================================
alter table public.prospects   enable row level security;
alter table public.leads       enable row level security;
alter table public.lead_events enable row level security;
alter table public.admin_users enable row level security;

-- service_role bypass automatique. Pas de policy publique sur prospects/leads/lead_events.
-- admin_users : utilisateur authentifié peut lire sa propre fiche (pour check whitelist côté middleware).
create policy admin_users_self_read
  on public.admin_users
  for select
  to authenticated
  using (email = (auth.jwt() ->> 'email')::citext);

-- ============================================================
-- 10. Comments
-- ============================================================
comment on table public.prospects   is 'Annuaire de contacts uniques (1 par email). Phase B MVP v1.';
comment on table public.leads       is '1 ligne par soumission de formulaire. id = token magic link prospect.';
comment on table public.lead_events is 'Audit trail : notes admin + actions (RGPD, status change, etc.).';
comment on table public.admin_users is 'Whitelist OAuth Google. Accès dashboard /admin.';
