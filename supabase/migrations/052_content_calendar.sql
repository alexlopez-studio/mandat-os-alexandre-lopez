-- 052_content_calendar.sql
-- Calendrier editorial adosse a la veille.
--
-- La chaine est : article de veille (news_items) -> angle editorial (content_angles)
-- -> declinaisons datees par canal (content_posts). La veille cessait d'etre un
-- cul-de-sac : le statut `newsletter` de 051 n'avait aucun debouche.
--
-- Deux tables plutot qu'une : l'angle n'est ni date ni rattache a un canal, le post
-- l'est toujours. Les fondre imposerait des colonnes nullables partout et rendrait
-- le filtrage du calendrier ambigu.
--
-- La planification est ecrite par Claude via l'API machine-a-machine
-- (/api/market/content), d'ou `created_by`. Le canal `blog` produit un brouillon
-- markdown destine a Sanity : `external_ref` / `external_url` gardent le lien vers
-- le document publie, sans que cette migration ne presuppose l'integration.
--
-- Meme parti pris que 051 : pas d'enum PG (text + check), RLS active sans policy,
-- acces service_role uniquement via supabaseAdmin.

-- ── Angles editoriaux ────────────────────────────────────────────────────────

create table if not exists public.content_angles (
  id           uuid primary key default gen_random_uuid(),
  news_item_id uuid references public.news_items(id) on delete set null,
  title        text not null,
  angle        text,                       -- le point de vue, ce qu'on raconte
  pillar       text
    constraint content_angles_pillar_check check (
      pillar in ('taux','reglementation','marche_national','marche_local','premium','conseils')
    ),
  insee_code   text,                       -- NULL = national ; sinon commune
  city         text,
  status       text not null default 'idea'
    constraint content_angles_status_check check (
      status in ('idea','planned','done','dropped')
    ),
  notes        text,
  created_by   text not null default 'claude'
    constraint content_angles_created_by_check check (created_by in ('claude','admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists content_angles_news_item_idx on public.content_angles (news_item_id);
create index if not exists content_angles_status_idx    on public.content_angles (status);
create index if not exists content_angles_created_at_idx on public.content_angles (created_at desc);

comment on table public.content_angles is
  'Idee editoriale, generalement issue d''un article de veille. Se decline en content_posts.';
comment on column public.content_angles.pillar is
  'Pilier editorial, aligne sur news_items.category.';
comment on column public.content_angles.created_by is
  'claude = propose par la skill calendrier-editorial ; admin = saisi depuis l''app.';

-- ── Declinaisons datees ──────────────────────────────────────────────────────

create table if not exists public.content_posts (
  id            uuid primary key default gen_random_uuid(),
  angle_id      uuid not null references public.content_angles(id) on delete cascade,
  channel       text not null
    constraint content_posts_channel_check check (
      channel in ('blog','linkedin','instagram','facebook','newsletter')
    ),
  scheduled_for timestamptz,               -- NULL = a produire, pas encore planifie
  status        text not null default 'draft'
    constraint content_posts_status_check check (
      status in ('draft','ready','scheduled','published','cancelled')
    ),
  title         text,
  body          text,                      -- texte pret a copier ; markdown pour le blog
  hook          text,
  cta           text,
  visual_brief  text,
  hashtags      text[] not null default '{}'::text[],
  seo_slug      text,                      -- canal blog uniquement
  seo_keyword   text,
  seo_description text,
  external_ref  text,                      -- id du document Sanity
  external_url  text,                      -- URL du post publie
  published_at  timestamptz,
  created_by    text not null default 'claude'
    constraint content_posts_created_by_check check (created_by in ('claude','admin')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists content_posts_scheduled_idx on public.content_posts (scheduled_for);
create index if not exists content_posts_status_idx    on public.content_posts (status);
create index if not exists content_posts_channel_idx   on public.content_posts (channel);
create index if not exists content_posts_angle_idx     on public.content_posts (angle_id);

comment on table public.content_posts is
  'Declinaison datee d''un angle sur un canal. Une ligne = un post a publier.';
comment on column public.content_posts.scheduled_for is
  'NULL = pas encore planifie (onglet "A produire").';
comment on column public.content_posts.external_ref is
  'Reference externe : id du document Sanity pour le canal blog.';

-- ── Triggers updated_at ──────────────────────────────────────────────────────

drop trigger if exists content_angles_updated_at on public.content_angles;
create trigger content_angles_updated_at
  before update on public.content_angles
  for each row execute function public.set_updated_at();

drop trigger if exists content_posts_updated_at on public.content_posts;
create trigger content_posts_updated_at
  before update on public.content_posts
  for each row execute function public.set_updated_at();

-- ── RLS : service_role uniquement (pattern 051 / 033) ────────────────────────

alter table public.content_angles enable row level security;
alter table public.content_posts  enable row level security;

-- ── Dette 051 : trigger updated_at manquant sur news_items ───────────────────
-- La convention (001/002) pose ce trigger sur toute table horodatee ; 051 l'a
-- oublie, seule la route PATCH mettait updated_at a jour, a la main.

drop trigger if exists news_items_updated_at on public.news_items;
create trigger news_items_updated_at
  before update on public.news_items
  for each row execute function public.set_updated_at();

comment on table public.news_items is
  'Veille immobiliere : articles moissonnes puis qualifies. Source des angles editoriaux.';
comment on column public.news_items.relevance is
  'Pertinence 0-100 pour la cible Var / premium, posee a l''ingestion.';
comment on column public.news_items.confidence is
  'verified = source primaire ; external = presse ; hypothesis = deduction a verifier.';
comment on column public.news_items.raw_json is
  'Charge brute renvoyee par le collecteur, conservee pour rejouer une qualification.';
