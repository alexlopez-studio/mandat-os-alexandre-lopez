-- =============================================================
-- Migration 006 — Liste Chaude (réseau / bouche-à-oreille)
-- CRM léger de suivi du réseau personnel et des recommandations.
--
-- Tables créées :
--   warm_contacts          ← contacts du réseau (manuels ou importés vCard/CSV)
--   warm_contact_events    ← historique d'activité par contact (timeline CRM)
-- =============================================================

create extension if not exists "pgcrypto";

-- set_updated_at() est défini dans les migrations 001/002 ; on le (re)définit
-- ici pour rendre cette migration auto-suffisante.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Types ENUM ──────────────────────────────────────────────
do $$ begin
  create type public.warm_contact_status as enum (
    'a_contacter',
    'contacte',
    'relance',
    'termine'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.warm_event_type as enum (
    'call',
    'email',
    'message',
    'meeting',
    'note',
    'status_change',
    'referral',
    'import'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 1. Table: warm_contacts
-- ============================================================
create table if not exists public.warm_contacts (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  relation         text,
  phone            text,
  email            text,
  status           public.warm_contact_status not null default 'a_contacter',
  referrals        jsonb not null default '[]'::jsonb,
  follow_up_date   date,
  notes            text,
  source           text not null default 'manual',
  last_contacted_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index de recherche / dédup
create index if not exists warm_contacts_status_idx      on public.warm_contacts (status);
create index if not exists warm_contacts_follow_up_idx   on public.warm_contacts (follow_up_date);
create index if not exists warm_contacts_created_at_idx  on public.warm_contacts (created_at desc);
create index if not exists warm_contacts_phone_idx       on public.warm_contacts (phone);
create index if not exists warm_contacts_email_idx       on public.warm_contacts (lower(email));

create trigger warm_contacts_updated_at
  before update on public.warm_contacts
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Table: warm_contact_events (timeline CRM)
-- ============================================================
create table if not exists public.warm_contact_events (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.warm_contacts(id) on delete cascade,
  type        public.warm_event_type not null default 'note',
  content     text,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists warm_contact_events_contact_idx
  on public.warm_contact_events (contact_id, occurred_at desc);

create index if not exists warm_contact_events_type_idx
  on public.warm_contact_events (type);

-- ============================================================
-- 3. Row Level Security
--    Accès via service_role uniquement (API routes admin).
-- ============================================================
alter table public.warm_contacts       enable row level security;
alter table public.warm_contact_events enable row level security;

-- ============================================================
-- 4. Comments
-- ============================================================
comment on table public.warm_contacts is 'Liste Chaude : contacts du réseau personnel (manuels ou importés vCard/CSV) suivis comme un CRM léger.';
comment on table public.warm_contact_events is 'Historique d''activité par contact de la Liste Chaude (appels, emails, notes, changements de statut...).';
comment on column public.warm_contacts.referrals is 'Noms des personnes recommandées par ce contact (tableau JSON de chaînes).';
comment on column public.warm_contacts.source is 'Origine du contact : manual | vcard | csv | import.';
