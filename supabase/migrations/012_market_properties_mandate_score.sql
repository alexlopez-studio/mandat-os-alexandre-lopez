-- ═══════════════════════════════════════════════════════════════
-- 012 — Persistance du MandateProbabilityScore sur market_properties
-- Permet de comparer la phase d'une sync à l'autre (alertes de
-- franchissement de seuil) et de trier/filtrer côté serveur plus tard.
-- Le score reste recalculé à la volée dans les routes de lecture ; ces
-- colonnes sont le snapshot au dernier passage de sync.
-- ═══════════════════════════════════════════════════════════════

alter table public.market_properties
  add column if not exists mandate_score smallint,
  add column if not exists mandate_phase text,
  add column if not exists scored_at timestamptz;

-- Tri/filtre serveur par score et phase.
create index if not exists market_properties_mandate_score_idx
  on public.market_properties (mandate_score desc nulls last);

create index if not exists market_properties_mandate_phase_idx
  on public.market_properties (mandate_phase);
