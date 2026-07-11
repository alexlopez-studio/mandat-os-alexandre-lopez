-- Migration 004 — Matching acquéreur / vendeur
-- Tables pour stocker les critères des leads et permettre le matching
-- avec les biens du marché (market_properties)

-- ── 1. Buyer criteria ──────────────────────────────────────────
-- Stocke les critères de recherche d'un acquéreur
CREATE TABLE IF NOT EXISTS buyer_criteria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     TEXT NOT NULL,
  prospect_id TEXT,
  type_bien   VARCHAR(50),
  communes    TEXT[],
  budget_max  NUMERIC(12,2),
  surface_min NUMERIC(8,2),
  pieces_min  INTEGER,
  criteres    TEXT[],
  active      BOOLEAN NOT NULL DEFAULT true,
  matched_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_criteria_lead_id ON buyer_criteria(lead_id);
CREATE INDEX idx_buyer_criteria_active ON buyer_criteria(active);
CREATE INDEX idx_buyer_criteria_communes ON buyer_criteria USING GIN(communes);

-- ── 2. Seller properties ───────────────────────────────────────
-- Stocke les caractéristiques d'un bien mis en vente (lead vendeur)
CREATE TABLE IF NOT EXISTS seller_properties (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        TEXT NOT NULL,
  prospect_id    TEXT,
  adresse        TEXT,
  lat            NUMERIC(10,7),
  lon            NUMERIC(10,7),
  type_bien      VARCHAR(50),
  sous_type      VARCHAR(50),
  surface        NUMERIC(8,2),
  surface_terrain NUMERIC(8,2),
  nb_pieces      INTEGER,
  etat           VARCHAR(50),
  dpe            VARCHAR(10),
  annee_construction INTEGER,
  equipements    TEXT[],
  delai          VARCHAR(50),
  prix_estime    NUMERIC(12,2),
  actif          BOOLEAN NOT NULL DEFAULT true,
  matched_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_properties_lead_id ON seller_properties(lead_id);
CREATE INDEX idx_seller_properties_actif ON seller_properties(actif);
CREATE INDEX idx_seller_properties_type ON seller_properties(type_bien);

-- ── 3. Match results ───────────────────────────────────────────
-- Stocke les résultats des matchs pour consultation rapide
CREATE TABLE IF NOT EXISTS match_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_lead_id   TEXT NOT NULL,
  property_id     UUID,       -- NULL si c'est un bien vendeur, renvoie à market_properties
  seller_lead_id  TEXT,       -- NULL si c'est un bien du marché
  property_type   VARCHAR(20) NOT NULL DEFAULT 'market',  -- 'market' | 'seller'
  score           INTEGER NOT NULL DEFAULT 0,
  score_details   JSONB,      -- { commune: 30, type: 20, budget: 25, surface: 15, pieces: 10 }
  matched_commune BOOLEAN DEFAULT false,
  matched_type    BOOLEAN DEFAULT false,
  matched_budget  BOOLEAN DEFAULT false,
  matched_surface BOOLEAN DEFAULT false,
  matched_pieces  BOOLEAN DEFAULT false,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_results_buyer ON match_results(buyer_lead_id);
CREATE INDEX idx_match_results_property ON match_results(property_id);
CREATE INDEX idx_match_results_seller ON match_results(seller_lead_id);
CREATE INDEX idx_match_results_score ON match_results(score DESC);
CREATE UNIQUE INDEX idx_match_results_unique ON match_results(buyer_lead_id, property_id, seller_lead_id, property_type)
  WHERE property_id IS NOT NULL OR seller_lead_id IS NOT NULL;

-- ── 4. Trigger updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_matching_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_buyer_criteria_updated_at
  BEFORE UPDATE ON buyer_criteria
  FOR EACH ROW EXECUTE FUNCTION update_matching_timestamp();

CREATE TRIGGER trg_seller_properties_updated_at
  BEFORE UPDATE ON seller_properties
  FOR EACH ROW EXECUTE FUNCTION update_matching_timestamp();

-- ── 5. Row Level Security ─────────────────────────────────────
ALTER TABLE buyer_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

-- Admin can do everything (service_role bypasses RLS)
-- Pour l'usage via supabaseAdmin (service_role), on laisse passer.
-- Si on voulait restreindre côté client, on ajouterait des policies.
-- Pour MVP, on laisse les policies par défaut (tout accessible via service_role).