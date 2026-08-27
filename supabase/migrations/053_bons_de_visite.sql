-- 053_bons_de_visite.sql
-- Table et index pour la gestion des bons de visite numériques
-- avec signature tactile, intégration CRM et envoi d'email aux visiteurs.

create table if not exists public.bons_de_visite (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  token               text not null unique default encode(gen_random_bytes(16), 'hex'),
  project_id          uuid references public.projects(id) on delete set null,
  
  -- Bien visité
  property_address    text not null,
  property_city       text not null,
  property_zipcode    text,
  property_type       text,
  property_price      numeric,
  mandate_ref         text,
  
  -- Visite & Visiteurs
  visit_at            timestamptz not null default now(),
  visitors_count      integer not null default 1,
  visitors            jsonb not null default '[]'::jsonb,
  
  -- Engagements légaux & Signature
  legal_text          text not null,
  signature_data_url  text not null,
  signer_name         text not null,
  
  -- Conseiller mandataire
  advisor_name        text not null default 'Alexandre Lopez',
  advisor_email       text not null default 'alexandre.lopez@iadfrance.fr',
  advisor_phone       text not null default '06 13 18 01 68',
  advisor_rsac        text not null default 'RSAC de Draguignan n° 908 906 423',
  
  -- Statut d'envoi d'email
  email_status        text not null default 'pending'
    constraint bons_de_visite_email_status_check check (
      email_status in ('pending', 'sent', 'partial', 'failed')
    ),
  email_sent_at       timestamptz,
  
  -- Notes de visite
  notes               text,
  
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists bons_de_visite_project_id_idx on public.bons_de_visite (project_id);
create index if not exists bons_de_visite_token_idx      on public.bons_de_visite (token);
create index if not exists bons_de_visite_reference_idx  on public.bons_de_visite (reference);
create index if not exists bons_de_visite_visit_at_idx   on public.bons_de_visite (visit_at desc);
create index if not exists bons_de_visite_created_at_idx on public.bons_de_visite (created_at desc);

comment on table public.bons_de_visite is
  'Bons de visite numériques signés lors des visites de biens immobiliers.';
comment on column public.bons_de_visite.visitors is
  'Liste des visiteurs : [{ first_name, last_name, cni_number, email, phone }]';
comment on column public.bons_de_visite.token is
  'Token sécurisé pour la consultation publique / client du bon de visite.';

-- Trigger updated_at
drop trigger if exists bons_de_visite_updated_at on public.bons_de_visite;
create trigger bons_de_visite_updated_at
  before update on public.bons_de_visite
  for each row execute function public.set_updated_at();

-- RLS
alter table public.bons_de_visite enable row level security;
