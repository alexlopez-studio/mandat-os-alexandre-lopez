-- 023 — Espace de travail pre-mandat sur les opportunites vendeur

alter table public.opportunities
  add column if not exists property_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists professional_opinion jsonb not null default '{}'::jsonb;

comment on column public.opportunities.property_snapshot is
  'Donnees bien / technique / preparation mandat saisies avant mandat signe.';

comment on column public.opportunities.professional_opinion is
  'Avis de valeur, estimation, arguments et comparables saisis avant mandat signe.';
