-- 015 — Observatoire DVF
-- Tables dédiées aux mutations réelles DVF, séparées des annonces Stream Estate.

create table if not exists public.dvf_communes (
  id uuid primary key default gen_random_uuid(),
  insee_code text not null unique,
  name text not null,
  zipcode text,
  department_code text,
  active boolean not null default true,
  last_imported_at timestamptz,
  last_import_year integer,
  last_import_status text,
  last_import_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dvf_transactions (
  id uuid primary key default gen_random_uuid(),
  source_row_id text not null unique,
  mutation_id text not null,
  disposition_number integer,
  mutation_date date,
  mutation_year integer,
  nature_mutation text,
  value numeric,
  address_number text,
  address_suffix text,
  street_name text,
  postal_code text,
  insee_code text not null,
  city_name text,
  department_code text,
  parcel_id text,
  lot_count integer,
  local_type_code text,
  local_type text,
  built_surface numeric,
  rooms integer,
  land_nature text,
  land_surface numeric,
  longitude double precision,
  latitude double precision,
  price_per_m2 numeric,
  source_file_year integer not null,
  raw_json jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.dvf_import_runs (
  id uuid primary key default gen_random_uuid(),
  insee_code text not null,
  commune_name text,
  department_code text,
  source_file_year integer not null,
  source_url text not null,
  status text not null default 'running',
  scanned_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_dvf_communes_active
  on public.dvf_communes(active);

create index if not exists idx_dvf_transactions_insee_date
  on public.dvf_transactions(insee_code, mutation_date desc);

create index if not exists idx_dvf_transactions_insee_type
  on public.dvf_transactions(insee_code, local_type);

create index if not exists idx_dvf_transactions_price_m2
  on public.dvf_transactions(insee_code, price_per_m2);

create index if not exists idx_dvf_transactions_year
  on public.dvf_transactions(mutation_year);

create index if not exists idx_dvf_import_runs_insee_started
  on public.dvf_import_runs(insee_code, started_at desc);

alter table public.dvf_communes enable row level security;
alter table public.dvf_transactions enable row level security;
alter table public.dvf_import_runs enable row level security;

drop policy if exists "Admin service role can manage dvf_communes" on public.dvf_communes;
create policy "Admin service role can manage dvf_communes"
  on public.dvf_communes for all
  using (true)
  with check (true);

drop policy if exists "Admin service role can manage dvf_transactions" on public.dvf_transactions;
create policy "Admin service role can manage dvf_transactions"
  on public.dvf_transactions for all
  using (true)
  with check (true);

drop policy if exists "Admin service role can manage dvf_import_runs" on public.dvf_import_runs;
create policy "Admin service role can manage dvf_import_runs"
  on public.dvf_import_runs for all
  using (true)
  with check (true);

comment on table public.dvf_communes is 'Communes suivies pour l’observatoire DVF.';
comment on table public.dvf_transactions is 'Mutations DVF importées depuis les fichiers publics gouvernementaux, filtrées par commune.';
comment on table public.dvf_import_runs is 'Journal des imports DVF par commune et millésime.';
comment on column public.dvf_transactions.source_row_id is 'Identifiant stable construit depuis le millésime et la ligne source DVF.';
comment on column public.dvf_transactions.price_per_m2 is 'Prix au m² bâti calculé seulement si valeur et surface bâtie sont disponibles.';
