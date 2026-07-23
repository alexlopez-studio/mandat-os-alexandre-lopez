-- 029 — Compte client de démonstration : isolation is_test

alter table public.opportunities
  add column if not exists is_test boolean not null default false;

alter table public.client_dossiers
  add column if not exists is_test boolean not null default false;

alter table public.client_dossier_events
  add column if not exists is_test boolean not null default false;

alter table public.leads
  add column if not exists is_test boolean not null default false;

create index if not exists opportunities_is_test_idx
  on public.opportunities (is_test) where is_test = true;

create index if not exists client_dossiers_is_test_idx
  on public.client_dossiers (is_test) where is_test = true;

create index if not exists client_dossier_events_is_test_idx
  on public.client_dossier_events (is_test) where is_test = true;

create index if not exists leads_is_test_idx
  on public.leads (is_test) where is_test = true;

comment on column public.opportunities.is_test is
  'Marque les opportunités de démo/formation à exclure des stats et listes réelles.';
comment on column public.client_dossiers.is_test is
  'Marque les dossiers clients de démo/formation à exclure des stats et listes réelles.';
comment on column public.client_dossier_events.is_test is
  'Dénormalisé depuis client_dossiers.is_test pour permettre un filtre direct sans jointure (ex: dashboard "Actions dues").';
comment on column public.leads.is_test is
  'Marque les leads de démo/formation à exclure des listes/stats de prospection réelles.';
