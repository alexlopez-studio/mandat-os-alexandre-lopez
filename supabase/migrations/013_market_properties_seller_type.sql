-- ═══════════════════════════════════════════════════════════════
-- 013 — Type de vendeur sur market_properties (gagnabilité du mandat)
-- 'individual' (particulier/PAP) | 'agency' (annonce d'agence) | null (inconnu).
-- Capté depuis publisherTypes / adverts[].publisher de l'API Stream Estate.
-- Dimension de lecture (badge + filtre), distincte du score de motivation.
-- ═══════════════════════════════════════════════════════════════

alter table public.market_properties
  add column if not exists seller_type text;

create index if not exists market_properties_seller_type_idx
  on public.market_properties (seller_type);
