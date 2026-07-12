-- 028 — Lien client stable et non devinable pour les dossiers clients

create extension if not exists pgcrypto;

alter table public.client_dossiers
  add column if not exists public_token text;

update public.client_dossiers
set public_token = regexp_replace(
  replace(replace(encode(gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'),
  '=+$',
  ''
)
where public_token is null;

alter table public.client_dossiers
  alter column public_token set default regexp_replace(
    replace(replace(encode(gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'),
    '=+$',
    ''
  );

alter table public.client_dossiers
  alter column public_token set not null;

create unique index if not exists client_dossiers_public_token_unique_idx
  on public.client_dossiers (public_token);
