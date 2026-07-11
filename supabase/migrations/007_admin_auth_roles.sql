-- =============================================================
-- Migration 007 — Authentification admin multi-utilisateurs + rôles
--
-- Fait évoluer la table admin_users (whitelist) vers de vrais comptes
-- liés à Supabase Auth (auth.users), avec rôles super_admin / admin.
-- =============================================================

-- ── Rôle ENUM ───────────────────────────────────────────────
do $$ begin
  create type public.admin_role as enum ('super_admin', 'admin');
exception when duplicate_object then null;
end $$;

-- ── Colonnes ────────────────────────────────────────────────
alter table public.admin_users
  add column if not exists user_id    uuid references auth.users(id) on delete cascade,
  add column if not exists role       public.admin_role not null default 'admin',
  add column if not exists full_name  text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists admin_users_user_id_idx on public.admin_users (user_id);

-- ── Trigger updated_at ──────────────────────────────────────
drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

-- ── Super admin initial ─────────────────────────────────────
-- Le user_id sera renseigné automatiquement à la première connexion
-- (ou par la création via l'API bootstrap / la page Utilisateurs).
insert into public.admin_users (email, role, is_active)
values ('alexlopez.studio@gmail.com', 'super_admin', true)
on conflict (email) do update set role = 'super_admin', is_active = true;

-- ── RLS : lecture de sa propre fiche par l'utilisateur connecté ──
-- (les écritures passent par les API routes en service_role).
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
  on public.admin_users
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or email = (auth.jwt() ->> 'email')::citext
  );

comment on column public.admin_users.user_id is 'Lien vers auth.users (Supabase Auth). Null tant que le compte n''a pas encore été créé/connecté.';
comment on column public.admin_users.role is 'super_admin : gère les utilisateurs. admin : accès standard au back-office.';
