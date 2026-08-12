-- ==============================================================================
-- 046_client_documents_storage_fix.sql
-- Fix prod : la partie storage de la migration 021 (bucket 'client-documents'
-- + policies RLS) n'a jamais été appliquée en base de production. Découvert
-- lors du test d'intégration document du 12/08/2026 (upload 404 'Bucket not
-- found', storage.buckets vide).
-- S'ajoute : policy opportunities_client_portal_select absente aussi.
-- Idempotent : peut être rejoué sans risque.
-- ==============================================================================

-- 1. Bucket storage (créé en local par 021, absent en prod)
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- 2. Policies storage.objects pour le bucket client-documents (portail client)
drop policy if exists client_documents_storage_insert on storage.objects;
create policy client_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'client-documents' and owner = auth.uid());

drop policy if exists client_documents_storage_select on storage.objects;
create policy client_documents_storage_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'client-documents' and owner = auth.uid());

-- 3. (obsolete) La policy opportunities_client_portal_select de 021 ne
--    s'applique pas en prod : opportunities y est une VUE (038_restore_views,
--    INSTEAD OF triggers) — les policies ne se créent pas sur les vues.
--    Le contrôle d'accès passe par les tables sous-jacentes.
