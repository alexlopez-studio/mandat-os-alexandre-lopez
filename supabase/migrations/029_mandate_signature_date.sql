-- 029 — Add mandate signature date to client_dossiers

alter table public.client_dossiers
  add column if not exists mandate_signed_at timestamptz;

create index if not exists client_dossiers_mandate_signed_at_idx
  on public.client_dossiers (mandate_signed_at);
