-- Seed rules for Mandat OS
-- Inserts preconfigured management rules for common scenarios.

INSERT INTO management_rules (name, description, active, trigger_type, conditions_json, actions_json, priority)
VALUES
-- 1. Grosse baisse de prix (>5%)
(
  'Baisse significative > 5%',
  'Détecte les biens dont le prix a baissé de plus de 5% et crée une opportunité haute priorité.',
  true,
  'big_price_drop',
  '{"all": []}'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Baisse significative détectée",
        "priority": "high"
      },
      {
        "type": "create_opportunity",
        "value": "Baisse > 5%",
        "stage": "À qualifier",
        "priority": "high"
      },
      {
        "type": "add_tag",
        "value": "Baisse significative"
      }
    ]
  }'::jsonb,
  'high'
),

-- 2. Nouveaux biens à surveiller
(
  'Nouveaux biens à surveiller',
  'Notifie dès qu\'un nouveau bien correspondant aux critères de mandat apparaît sur le marché.',
  true,
  'new_listing',
  '{"all": []}'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Nouveau bien sur le marché",
        "priority": "medium"
      },
      {
        "type": "add_tag",
        "value": "Nouvelle annonce"
      }
    ]
  }'::jsonb,
  'medium'
),

-- 3. Biens sous-évalués
(
  'Biens sous-évalués',
  'Identifie les biens dont le prix/m² est inférieur de 15% à la moyenne de la zone.',
  true,
  'price_per_m2_below',
  '{"all": []}'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Bien potentiellement sous-évalué",
        "priority": "high"
      },
      {
        "type": "create_opportunity",
        "value": "Sous-évalué",
        "stage": "À analyser",
        "priority": "high"
      },
      {
        "type": "add_tag",
        "value": "Sous-évalué"
      }
    ]
  }'::jsonb,
  'high'
),

-- 4. Biens stagnants > 90 jours
(
  'Biens stagnants > 90 jours',
  'Surveille les biens en ligne depuis plus de 90 jours sans baisse de prix.',
  false,
  'days_online_exceeded',
  '{
    "all": [
      {
        "field": "days_online",
        "operator": "gt",
        "value": 90
      }
    ]
  }'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Bien stagne depuis plus de 90 jours",
        "priority": "medium"
      },
      {
        "type": "create_opportunity",
        "value": "Bien stagnant",
        "stage": "À contacter",
        "priority": "medium"
      },
      {
        "type": "add_tag",
        "value": "Stagnant"
      }
    ]
  }'::jsonb,
  'medium'
),

-- 5. Baisse modérée 2-5%
(
  'Baisse modérée 2-5%',
  'Détecte les baisses de prix modérées pour suivi commercial.',
  false,
  'price_drop',
  '{"all": []}'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Baisse modérée détectée",
        "priority": "low"
      },
      {
        "type": "add_tag",
        "value": "Baisse modérée"
      }
    ]
  }'::jsonb,
  'low'
),

-- 6. Annonces expirées
(
  'Annonces expirées',
  'Repère les annonces qui expirent et pourraient être reprises en mandat.',
  true,
  'expired',
  '{"all": []}'::jsonb,
  '{
    "actions": [
      {
        "type": "create_notification",
        "value": "Annonce expirée détectée",
        "priority": "medium"
      },
      {
        "type": "create_opportunity",
        "value": "Annonce expirée",
        "stage": "À contacter",
        "priority": "medium"
      },
      {
        "type": "add_tag",
        "value": "Expiré"
      }
    ]
  }'::jsonb,
  'medium'
);