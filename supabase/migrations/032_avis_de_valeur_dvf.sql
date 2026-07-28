-- 032 — Avis de valeur : fonctions d'agrégation DVF
--
-- Support SQL du rapport A4 « avis de valeur ». Trois principes, issus de la note de méthode :
--   1. seules les mutations DVF (prix payés) servent de référence opposable ;
--      les annonces (market_properties) sont traitées à part, jamais mélangées ;
--   2. on segmente avant de médianiser : les bornes d'écrêtage sont paramétrables
--      par commune, pas figées dans la fonction ;
--   3. la tension se mesure par les volumes (rotation du parc), pas par les prix,
--      ce qui suppose de connaître le parc de logements communal.

-- ─── Paramètres par commune ────────────────────────────────────────────────

alter table public.dvf_communes
  add column if not exists housing_stock_houses integer,
  add column if not exists housing_stock_flats integer,
  add column if not exists price_m2_floor numeric,
  add column if not exists price_m2_ceiling numeric;

comment on column public.dvf_communes.housing_stock_houses is
  'Parc de maisons de la commune (INSEE). Sert au calcul de la rotation du parc.';
comment on column public.dvf_communes.housing_stock_flats is
  'Parc d''appartements de la commune (INSEE).';
comment on column public.dvf_communes.price_m2_floor is
  'Borne basse d''écrêtage du prix au m² pour la sélection des comparables. Calibrée commune par commune.';
comment on column public.dvf_communes.price_m2_ceiling is
  'Borne haute d''écrêtage du prix au m² pour la sélection des comparables.';

-- ─── 1. Série annuelle : volumes et médianes ──────────────────────────────

create or replace function public.dvf_serie_annuelle(
  p_insee text,
  p_type text default 'Maison',
  p_years integer default 5
)
returns table (
  annee integer,
  ventes bigint,
  prix_median numeric,
  m2_median numeric
)
language sql
stable
as $$
  with mut as (
    select
      mutation_year,
      mutation_id,
      max(value) as valeur,
      sum(built_surface) as surface
    from public.dvf_transactions
    where insee_code = p_insee
      and nature_mutation = 'Vente'
      and local_type = p_type
      and built_surface > 0
      and value > 0
    group by mutation_year, mutation_id
  )
  select
    mutation_year,
    count(*),
    round(percentile_cont(0.5) within group (order by valeur)),
    round(percentile_cont(0.5) within group (order by valeur / surface))
  from mut
  where valeur / surface between 500 and 12000
  group by mutation_year
  order by mutation_year desc
  limit p_years;
$$;

comment on function public.dvf_serie_annuelle is
  'Volumes de ventes et médianes (prix, prix/m²) par année pour une commune. Écrêtage large 500–12 000 €/m² : ici on décrit le marché, on ne sélectionne pas des comparables.';

-- ─── 2. Comparables : même surface, emprise foncière comparable ───────────

drop function if exists public.dvf_comparables(text, numeric, text, numeric, numeric, date, integer);

create or replace function public.dvf_comparables(
  p_insee text,
  p_surface numeric,
  p_type text default 'Maison',
  p_tolerance numeric default 0.22,
  p_min_terrain numeric default 0,
  p_max_terrain numeric default 350,
  p_since date default (current_date - interval '4 years'),
  p_limit integer default 10
)
returns table (
  mutation_id text,
  mutation_date date,
  adresse text,
  surface numeric,
  pieces integer,
  terrain numeric,
  prix numeric,
  prix_m2 numeric,
  lat double precision,
  lon double precision
)
language sql
stable
as $$
  with bornes as (
    select
      coalesce((select price_m2_floor from public.dvf_communes where insee_code = p_insee), 800) as plancher,
      coalesce((select price_m2_ceiling from public.dvf_communes where insee_code = p_insee), 8000) as plafond
  ),
  parcelles as (
    select distinct mutation_id, parcel_id, land_surface
    from public.dvf_transactions
    where insee_code = p_insee
      and land_surface > 0
  ),
  terrains as (
    select mutation_id, sum(land_surface) as terrain
    from parcelles
    group by mutation_id
  ),
  mut as (
    select
      t.mutation_id,
      min(t.mutation_date) as d,
      trim(max(coalesce(t.address_number, '') || ' ' || coalesce(t.street_name, ''))) as adresse,
      max(t.value) as valeur,
      sum(t.built_surface) as surface,
      max(t.rooms) as pieces,
      max(t.latitude) as lat,
      max(t.longitude) as lon
    from public.dvf_transactions t
    where t.insee_code = p_insee
      and t.nature_mutation = 'Vente'
      and t.local_type = p_type
      and t.mutation_date >= p_since
      and t.built_surface > 0
      and t.value > 0
    group by t.mutation_id
  )
  select
    m.mutation_id,
    m.d,
    nullif(m.adresse, ''),
    m.surface,
    m.pieces,
    coalesce(te.terrain, 0),
    m.valeur,
    round(m.valeur / m.surface),
    m.lat,
    m.lon
  from mut m
  cross join bornes b
  left join terrains te on te.mutation_id = m.mutation_id
  where m.surface between p_surface * (1 - p_tolerance) and p_surface * (1 + p_tolerance)
    -- Encadrement du terrain, et non simple plafond : un 65 m² sur 800 m² n'est
    -- pas comparable à un 65 m² sur 40 m², dans un sens comme dans l'autre.
    and coalesce(te.terrain, 0) between p_min_terrain and p_max_terrain
    and m.valeur / m.surface between b.plancher and b.plafond
  order by m.d desc
  limit p_limit;
$$;

comment on function public.dvf_comparables is
  'Ventes DVF comparables à un bien : surface ±tolérance, emprise foncière encadrée, écrêtage du prix/m² lu dans dvf_communes. Le filtre terrain est celui que l''on oublie le plus souvent et celui qui fausse le plus.';

-- ─── 3. Distribution des prix au m² sur le segment comparable ─────────────

drop function if exists public.dvf_distribution_m2(text, text, date);

create or replace function public.dvf_distribution_m2(
  p_insee text,
  p_type text default 'Maison',
  p_since date default (current_date - interval '5 years')
)
returns table (
  prix_m2 numeric,
  mutation_date date,
  surface numeric,
  terrain numeric
)
language sql
stable
as $$
  with bornes as (
    select
      coalesce((select price_m2_floor from public.dvf_communes where insee_code = p_insee), 800) as plancher,
      coalesce((select price_m2_ceiling from public.dvf_communes where insee_code = p_insee), 8000) as plafond
  ),
  parcelles as (
    select distinct mutation_id, parcel_id, land_surface
    from public.dvf_transactions
    where insee_code = p_insee
      and land_surface > 0
  ),
  terrains as (
    select mutation_id, sum(land_surface) as terrain
    from parcelles
    group by mutation_id
  ),
  mut as (
    select
      mutation_id,
      min(mutation_date) as d,
      max(value) as valeur,
      sum(built_surface) as surface
    from public.dvf_transactions
    where insee_code = p_insee
      and nature_mutation = 'Vente'
      and local_type = p_type
      and mutation_date >= p_since
      and built_surface > 0
      and value > 0
    group by mutation_id
  )
  select round(m.valeur / m.surface), m.d, m.surface, coalesce(te.terrain, 0)
  from mut m
  cross join bornes b
  left join terrains te on te.mutation_id = m.mutation_id
  where m.valeur / m.surface between b.plancher and b.plafond
  order by 1;
$$;

comment on function public.dvf_distribution_m2 is
  'Prix au m² unitaires des mutations d''une commune, écrêtés, avec surface et terrain. Le filtrage sur le segment comparable se fait côté applicatif, là où la détection de bimodalité a lieu.';

grant execute on function public.dvf_serie_annuelle(text, text, integer) to service_role;
grant execute on function public.dvf_comparables(text, numeric, text, numeric, numeric, numeric, date, integer) to service_role;
grant execute on function public.dvf_distribution_m2(text, text, date) to service_role;
