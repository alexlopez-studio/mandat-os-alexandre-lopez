alter table public.client_dossiers
  add column if not exists client_type text not null default 'seller',
  add column if not exists buyer_lead_id text;

alter table public.client_dossiers
  drop constraint if exists client_dossiers_client_type_check;

alter table public.client_dossiers
  add constraint client_dossiers_client_type_check
  check (client_type in ('seller', 'buyer'));

alter table public.client_dossiers
  drop constraint if exists client_dossiers_scope_check;

alter table public.client_dossiers
  add constraint client_dossiers_scope_check check (
    lead_id is not null
    or seller_property_id is not null
    or opportunity_id is not null
    or buyer_lead_id is not null
    or property_snapshot <> '{}'::jsonb
  );

create index if not exists client_dossiers_client_type_idx
  on public.client_dossiers (client_type, updated_at desc);

create unique index if not exists client_dossiers_buyer_lead_unique_idx
  on public.client_dossiers (buyer_lead_id)
  where buyer_lead_id is not null;

comment on column public.client_dossiers.client_type is
  'Type de client : seller pour mandat de vente, buyer pour mandat de recherche.';
comment on column public.client_dossiers.buyer_lead_id is
  'Identifiant buyer_criteria.lead_id rattache au dossier client acquereur.';
