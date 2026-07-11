-- 022 — Autoriser les dossiers clients crees manuellement depuis le back-office

alter table public.client_dossiers
  drop constraint if exists client_dossiers_scope_check;

alter table public.client_dossiers
  add constraint client_dossiers_scope_check check (
    lead_id is not null
    or seller_property_id is not null
    or opportunity_id is not null
    or property_snapshot <> '{}'::jsonb
  );
