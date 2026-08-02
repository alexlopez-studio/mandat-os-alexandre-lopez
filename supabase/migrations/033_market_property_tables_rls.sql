-- Activation de RLS sur les deux tables introduites par la migration 020.
--
-- Elles etaient les seules tables du schema public a avoir RLS desactive :
-- n'importe qui disposant de la cle publique pouvait donc les lire et les
-- modifier via PostgREST. Verifie avant correction, les deux repondaient en
-- HTTP 200 a une requete anonyme.
--
-- Aucune policy n'est creee, volontairement. C'est le modele deja retenu pour
-- market_properties, property_notes, property_tags et property_price_history :
-- ces tables ne sont manipulees que cote serveur, via supabaseAdmin, et le
-- role de service contourne RLS. Ajouter une policy ouvrirait un acces dont
-- personne n'a besoin.
--
-- Prealable verifie avant application : SUPABASE_SERVICE_ROLE_KEY est bien
-- definie en Preview comme en Production. C'est necessaire, car makeClient()
-- retombe silencieusement sur la cle anonyme quand elle manque
-- (src/lib/supabase.ts) — dans ce cas les routes /api/market cesseraient de
-- fonctionner apres cette migration.

alter table public.market_property_duplicate_candidates enable row level security;
alter table public.market_property_sources enable row level security;
