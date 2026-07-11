-- Seed SQL pour les règles préconfigurées du Moteur Mandat OS
-- Date: 09/06/2026
-- Projet: Mandat OS MVP - Site Alexandre Lopez

-- ============================================
-- Règles pour la détection de biens à risque
-- ============================================

-- Règle 1: DPE G - Bien très énergivore
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'DPE G - Bien à risque',
  'Alerte si un bien a un DPE G (très énergivore). Ces biens sont difficiles à vendre et nécessitent des travaux importants.',
  'new_property',
  '{"dpe": {"eq": "G"}}',
  '{"notify": true, "tag": "dpe_g", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 2: DPE F - Bien énergivore
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'DPE F - Bien énergivore',
  'Alerte si un bien a un DPE F. Ces biens nécessitent des travaux pour améliorer leur performance énergétique.',
  'new_property',
  '{"dpe": {"eq": "F"}}',
  '{"notify": true, "tag": "dpe_f", "priority": "medium"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Règles pour la détection de prix anormaux
-- ============================================

-- Règle 3: Prix au m² anormalement bas
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Prix/m² trop bas - Opportunité',
  'Alerte si le prix au m² est inférieur de 30% à la moyenne du secteur. Peut indiquer une opportunité ou une erreur de saisie.',
  'new_property',
  '{"price_per_sqm": {"lt": {"field": "average_price_per_sqm", "percentage": 0.7}}}',
  '{"notify": true, "tag": "prix_bas", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 4: Prix au m² anormalement élevé
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Prix/m² trop élevé - Surévaluation',
  'Alerte si le prix au m² est supérieur de 30% à la moyenne du secteur. Peut indiquer une surévaluation.',
  'new_property',
  '{"price_per_sqm": {"gt": {"field": "average_price_per_sqm", "percentage": 1.3}}}',
  '{"notify": true, "tag": "prix_haut", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Règles pour la surface
-- ============================================

-- Règle 5: Très petite surface
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Surface très petite (< 20m²)',
  'Alerte pour les biens avec une surface habitable inférieure à 20m².',
  'new_property',
  '{"surface": {"lt": 20}}',
  '{"notify": true, "tag": "surface_petite", "priority": "medium"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 6: Très grande surface (> 200m²)
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Surface très grande (> 200m²)',
  'Alerte pour les biens avec une surface habitable supérieure à 200m². Marché de niche.',
  'new_property',
  '{"surface": {"gt": 200}}',
  '{"notify": true, "tag": "surface_grande", "priority": "medium"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Règles pour le temps sur le marché
-- ============================================

-- Règle 7: Bien en vente depuis plus de 6 mois
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Bien en vente depuis > 6 mois',
  'Alerte pour les biens qui sont en vente depuis plus de 6 mois. Peut indiquer un problème de prix ou de caractéristiques.',
  'daily_sync',
  '{"days_on_market": {"gt": 180}}',
  '{"notify": true, "tag": "longue_duree", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Règles pour les caractéristiques spéciales
-- ============================================

-- Règle 8: Bien sans photo
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Bien sans photo',
  'Alerte pour les biens qui n ont aucune photo. Les biens sans photo ont 80% moins de chances d être vendus.',
  'new_property',
  '{"photos_count": {"eq": 0}}',
  '{"notify": true, "tag": "sans_photo", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 9: Bien avec piscine
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Bien avec piscine',
  'Tag automatique pour les biens équipés d une piscine. Caractéristique premium.',
  'new_property',
  '{"has_pool": {"eq": true}}',
  '{"notify": false, "tag": "avec_piscine", "priority": "low"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 10: Bien avec jardin
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'Bien avec jardin',
  'Tag automatique pour les biens avec jardin/terrain.',
  'new_property',
  '{"has_garden": {"eq": true}}',
  '{"notify": false, "tag": "avec_jardin", "priority": "low"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Règles combinées (AND/OR)
-- ============================================

-- Règle 11: DPE G ET prix élevé (risque maximum)
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'DPE G + Prix élevé = Risque maximum',
  'Alerte prioritaire pour les biens avec DPE G ET prix supérieur à 300k€. Très difficile à vendre.',
  'new_property',
  '{"and": [{"dpe": {"eq": "G"}}, {"price": {"gt": 300000}}]}',
  '{"notify": true, "tag": "risque_maximum", "priority": "urgent"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Règle 12: DPE A ou B ET prix bas (opportunité)
INSERT INTO management_rules (name, description, trigger, conditions, actions, is_active, created_at)
VALUES (
  'DPE A/B + Prix bas = Bonne affaire',
  'Alerte pour les biens avec excellent DPE (A ou B) ET prix inférieur à la moyenne. Bonne opportunité.',
  'new_property',
  '{"and": [{"dpe": {"in": ["A", "B"]}}, {"price_per_sqm": {"lt": {"field": "average_price_per_sqm", "percentage": 0.9}}}]}',
  '{"notify": true, "tag": "bonne_affaire", "priority": "high"}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Configuration des zones surveillées par défaut
-- ============================================

-- Provence Verte (Var)
INSERT INTO monitored_zones (name, department, cities, is_active, created_at)
VALUES (
  'Provence Verte',
  'Var',
  '{"cities": ["Bauduen", "Aups", "Moustiers-Sainte-Marie", "Rougon", "La Palud-sur-Verdon", "Saint-Julien-le-Montagnier", "Varages", "Barjols", "Tavernes", "Cotignac"]}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Verdon (Alpes-de-Haute-Provence et Var)
INSERT INTO monitored_zones (name, department, cities, is_active, created_at)
VALUES (
  'Gorges du Verdon',
  'Mixed',
  '{"cities": ["Castellane", "Rougon", "La Palud-sur-Verdon", "Moustiers-Sainte-Marie", "Saint-André-les-Alpes", "Allos", "Colmars-les-Alpes"]}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Bouches-du-Rhône (partie Provence Verte)
INSERT INTO monitored_zones (name, department, cities, is_active, created_at)
VALUES (
  'Bouches-du-Rhône - Zone Est',
  'Bouches-du-Rhône',
  '{"cities": ["Salon-de-Provence", "Pélissanne", "Lambesc", "Rognes", "Saint-Cannat", "Éguilles"]}',
  true,
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ============================================
-- Commentaires
-- ============================================

-- Les règles utilisent un format JSON pour les conditions et actions
-- Format des conditions:
--   - Operateurs: eq, neq, lt, lte, gt, gte, in, not_in
--   - Comparaisons avec champs: {"field": "nom_du_champ", "percentage": valeur}
--   - Logique: and, or
--
-- Format des actions:
--   - notify: boolean (envoyer une notification)
--   - tag: string (tag à appliquer)
--   - priority: "low" | "medium" | "high" | "urgent"
--
-- Les déclencheurs (triggers) possibles:
--   - new_property: lors de l'ajout d'un nouveau bien
--   - daily_sync: lors de la synchronisation quotidienne
--   - manual: exécution manuelle via l'interface
