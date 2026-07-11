-- 020 — Diffusions d'un bien et rapprochement manuel des doublons

create table if not exists public.market_property_sources (
  id uuid primary key default gen_random_uuid(),
  market_property_id uuid not null references public.market_properties(id) on delete cascade,
  source text not null default 'stream_estate',
  portal text,
  external_id text,
  url text,
  title text,
  price integer,
  status text not null default 'active',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists market_property_sources_url_idx
  on public.market_property_sources (url)
  where url is not null;

create unique index if not exists market_property_sources_external_idx
  on public.market_property_sources (source, external_id)
  where external_id is not null;

create index if not exists market_property_sources_property_idx
  on public.market_property_sources (market_property_id, last_seen_at desc);

create table if not exists public.market_property_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.market_properties(id) on delete cascade,
  candidate_property_id uuid not null references public.market_properties(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  score integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (property_id <> candidate_property_id)
);

create unique index if not exists market_property_duplicate_pair_idx
  on public.market_property_duplicate_candidates (property_id, candidate_property_id);

create index if not exists market_property_duplicate_status_idx
  on public.market_property_duplicate_candidates (property_id, status);

insert into public.market_property_sources (
  market_property_id,
  source,
  portal,
  external_id,
  url,
  title,
  price,
  status,
  published_at,
  first_seen_at,
  last_seen_at,
  raw_json,
  created_at,
  updated_at
)
select
  id,
  source,
  case
    when url ilike '%leboncoin%' then 'Leboncoin'
    when url ilike '%seloger%' then 'SeLoger'
    when url ilike '%pap.fr%' then 'PAP'
    when url ilike '%bienici%' then 'Bien''ici'
    when url is not null then regexp_replace(regexp_replace(split_part(url, '/', 3), '^www\.', ''), '^m\.', '')
    else source
  end,
  external_id,
  url,
  title,
  price,
  status,
  published_at,
  first_seen_at,
  last_seen_at,
  raw_json,
  created_at,
  updated_at
from public.market_properties
where url is not null or external_id is not null
on conflict do nothing;

comment on table public.market_property_sources is 'Diffusions observees pour un meme bien canonique : un bien peut etre publie sur plusieurs portails.';
comment on table public.market_property_duplicate_candidates is 'Doublons probables entre biens, confirmes ou ecartes manuellement.';
