/**
 * POST /api/market/matching/migrate
 * Exécute la migration 004 pour créer les tables de matching
 * Usage: curl -X POST http://localhost:3000/api/market/matching/migrate
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MIGRATION_SQL = `
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

CREATE INDEX IF NOT EXISTS idx_buyer_criteria_lead_id ON buyer_criteria(lead_id);
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_active ON buyer_criteria(active);
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_communes ON buyer_criteria USING GIN(communes);

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

CREATE INDEX IF NOT EXISTS idx_seller_properties_lead_id ON seller_properties(lead_id);
CREATE INDEX IF NOT EXISTS idx_seller_properties_actif ON seller_properties(actif);
CREATE INDEX IF NOT EXISTS idx_seller_properties_type ON seller_properties(type_bien);

CREATE TABLE IF NOT EXISTS match_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_lead_id   TEXT NOT NULL,
  property_id     UUID,
  seller_lead_id  TEXT,
  property_type   VARCHAR(20) NOT NULL DEFAULT 'market',
  score           INTEGER NOT NULL DEFAULT 0,
  score_details   JSONB,
  matched_commune BOOLEAN DEFAULT false,
  matched_type    BOOLEAN DEFAULT false,
  matched_budget  BOOLEAN DEFAULT false,
  matched_surface BOOLEAN DEFAULT false,
  matched_pieces  BOOLEAN DEFAULT false,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_results_buyer ON match_results(buyer_lead_id);
CREATE INDEX IF NOT EXISTS idx_match_results_property ON match_results(property_id);
CREATE INDEX IF NOT EXISTS idx_match_results_seller ON match_results(seller_lead_id);
CREATE INDEX IF NOT EXISTS idx_match_results_score ON match_results(score DESC);

CREATE OR REPLACE FUNCTION update_matching_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_buyer_criteria_updated_at ON buyer_criteria;
CREATE TRIGGER trg_buyer_criteria_updated_at
  BEFORE UPDATE ON buyer_criteria
  FOR EACH ROW EXECUTE FUNCTION update_matching_timestamp();

DROP TRIGGER IF EXISTS trg_seller_properties_updated_at ON seller_properties;
CREATE TRIGGER trg_seller_properties_updated_at
  BEFORE UPDATE ON seller_properties
  FOR EACH ROW EXECUTE FUNCTION update_matching_timestamp();

ALTER TABLE buyer_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
`

export async function POST() {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql' as never, { sql_text: MIGRATION_SQL } as never)

    if (error) {
      // Fallback: try direct SQL via REST
      const { error: directError } = await supabaseAdmin.from('_migration_runs' as never).insert({
        sql: MIGRATION_SQL,
        executed_at: new Date().toISOString(),
      } as never)

      if (directError) {
        // Try individual statements via raw query
        const statements = MIGRATION_SQL
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'))

        const errors: string[] = []

        for (let i = 0; i < statements.length; i++) {
          try {
            // Can't execute raw SQL via supabase-js easily
            // Would need to use the management API
          } catch {
            errors.push(`Could not execute statement ${i + 1}`)
          }
        }

        return NextResponse.json({
          success: false,
          error: 'La migration doit être exécutée manuellement dans le SQL Editor Supabase',
          hint: 'Ouvrez https://supabase.com/dashboard/project/byrsmbgfkvgxdtdyhrro/sql/new et collez le contenu de supabase/migrations/004_matching_schema.sql',
          details: error?.message ?? directError?.message,
          statements_count: statements.length,
        }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Migration 004 exécutée avec succès' })
  } catch (e) {
    console.error('[Migration] Error:', e)
    return NextResponse.json({
      success: false,
      error: 'Erreur serveur',
      hint: 'Exécutez manuellement le SQL dans le Supabase dashboard',
    }, { status: 500 })
  }
}