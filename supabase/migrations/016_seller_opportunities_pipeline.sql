-- =============================================================
-- Migration 016 — Opportunites vendeur & pipeline simplifie
-- Enrichit les opportunites pour les pistes vendeur sans annonce
-- en ligne et migre les anciens libelles de pipeline.
-- =============================================================

alter table public.opportunities
  add column if not exists seller_name text,
  add column if not exists seller_phone text,
  add column if not exists seller_email text,
  add column if not exists source_channel text,
  add column if not exists property_address text,
  add column if not exists property_city text,
  add column if not exists property_zipcode text,
  add column if not exists property_type text,
  add column if not exists property_surface numeric(10,2),
  add column if not exists property_land_surface numeric(10,2),
  add column if not exists property_rooms integer,
  add column if not exists estimated_price_min numeric(12,2),
  add column if not exists estimated_price_max numeric(12,2),
  add column if not exists selling_timeline text,
  add column if not exists pre_estimation_done_at date,
  add column if not exists visit_at timestamptz,
  add column if not exists report_delivered_at date,
  add column if not exists follow_up_at date;

update public.opportunities
set stage = case stage
  when 'À qualifier' then 'Nouveau contact'
  when 'À analyser' then 'Pré-estimation'
  when 'À contacter' then 'Nouveau contact'
  when 'Contacté' then 'Pré-estimation'
  when 'Rendez-vous à préparer' then 'RDV / Visite'
  when 'En suivi' then 'Suivi moyen terme'
  when 'Mandat potentiel' then 'Décision vendeur'
  when 'Converti' then 'Mandat signé'
  when 'Écarté' then 'Perdu / Écarté'
  else stage
end
where stage in (
  'À qualifier',
  'À analyser',
  'À contacter',
  'Contacté',
  'Rendez-vous à préparer',
  'En suivi',
  'Mandat potentiel',
  'Converti',
  'Écarté'
);

create index if not exists opportunities_stage_idx
  on public.opportunities(stage);

create index if not exists opportunities_source_channel_idx
  on public.opportunities(source_channel);

create index if not exists opportunities_property_city_idx
  on public.opportunities(property_city);

create index if not exists opportunities_due_date_idx
  on public.opportunities(due_date);

create index if not exists opportunities_follow_up_at_idx
  on public.opportunities(follow_up_at);

comment on column public.opportunities.seller_name is 'Nom du vendeur ou contact principal pour les opportunites creees manuellement.';
comment on column public.opportunities.source_channel is 'Origine de la piste vendeur : flyer, appel entrant, recommandation, prospection, annonce, autre.';
comment on column public.opportunities.selling_timeline is 'Horizon de vente declare ou estime par le vendeur.';
comment on column public.opportunities.follow_up_at is 'Date de relance pour les pistes en suivi moyen terme ou en attente de decision.';
