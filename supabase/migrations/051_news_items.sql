-- 051_news_items.sql
-- Veille immobilière quotidienne : articles moissonnés, qualifiés, stockés.
-- Source de la newsletter mensuelle. Table admin interne (accès service_role via API).

create table if not exists public.news_items (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,              -- ex: 'var-matin', 'les-echos', 'fnaim'
  url          text not null,              -- lien article (canonical)
  title        text not null,
  summary      text,                       -- résumé 1-2 phrases
  key_figure   text,                       -- chiffre clé court (ex: "taux moyen 3,20 %")
  category     text not null
    constraint news_items_category_check check (
      category in ('taux','reglementation','marche_national','marche_local','premium','conseils')
    ),
  insee_code   text,                       -- NULL = national ; sinon commune (raccord zones de veille)
  city         text,
  zipcode      text,
  published_at timestamptz,                -- date de publication chez la source
  collected_at timestamptz not null default now(),
  relevance    smallint not null default 0  -- 0-100, pertinence pour la cible (Var/premium)
    constraint news_items_relevance_check check (relevance between 0 and 100),
  status       text not null default 'new'  -- new → reviewed → newsletter → published → archived
    constraint news_items_status_check check (
      status in ('new','reviewed','newsletter','published','archived')
    ),
  confidence   text not null default 'external'
    constraint news_items_confidence_check check (
      confidence in ('verified','external','hypothesis')
    ),
  raw_json     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint news_items_url_key unique (url)
);

create index if not exists news_items_published_at_idx on public.news_items (published_at desc nulls last);
create index if not exists news_items_category_idx  on public.news_items (category);
create index if not exists news_items_insee_idx     on public.news_items (insee_code);
create index if not exists news_items_status_idx    on public.news_items (status);
create index if not exists news_items_collected_at_idx on public.news_items (collected_at desc);

alter table public.news_items enable row level security;
-- Pas de policy : accès service_role uniquement (pattern market_properties / monitored_zones).
