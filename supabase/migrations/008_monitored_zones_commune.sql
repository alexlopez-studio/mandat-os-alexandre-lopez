-- Migration 008 — Zones surveillées : passage au modèle commune
--
-- Changements :
--   - Ajout de insee_code (identifiant officiel INSEE de la commune)
--   - Suppression de radius_km (on cible commune par commune, pas par rayon)
--   - Index sur insee_code pour les lookups cascade

ALTER TABLE monitored_zones
  ADD COLUMN IF NOT EXISTS insee_code TEXT;

ALTER TABLE monitored_zones
  DROP COLUMN IF EXISTS radius_km;

CREATE INDEX IF NOT EXISTS idx_monitored_zones_insee_code
  ON monitored_zones (insee_code);

CREATE INDEX IF NOT EXISTS idx_monitored_zones_zipcode
  ON monitored_zones (zipcode);

COMMENT ON COLUMN monitored_zones.insee_code IS 'Code INSEE officiel de la commune (5 chiffres). Null pour les zones créées avant cette migration.';
COMMENT ON COLUMN monitored_zones.zipcode IS 'Code postal utilisé pour les appels API Stream Estate. Plusieurs communes peuvent partager le même code postal.';
