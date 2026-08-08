-- ==============================================================================
-- 039_contact_types.sql
-- Annuaire de contacts unifie : typologie multiple (vendeur / acquereur /
-- partenaire pro / reseau) + integration du reseau (warm_contacts) dans contacts.
-- ==============================================================================

-- 1. Nouvelles colonnes sur contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS types text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS relation text;

DO $$ BEGIN
  ALTER TABLE public.contacts ADD CONSTRAINT contacts_types_valid
    CHECK (types <@ ARRAY['vendeur', 'acquereur', 'partenaire', 'reseau']::text[]);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_types ON public.contacts USING gin (types);

COMMENT ON COLUMN public.contacts.types IS 'Typologies manuelles du contact : vendeur | acquereur | partenaire | reseau. Un contact peut en cumuler plusieurs.';
COMMENT ON COLUMN public.contacts.company IS 'Societe / etude / enseigne, principalement pour les partenaires pro.';
COMMENT ON COLUMN public.contacts.relation IS 'Nature de la relation ou metier (notaire, courtier, ami, ancien client...).';

-- 2. Backfill des typologies a partir des projets rattaches
UPDATE public.contacts c
SET types = (
  SELECT array_agg(DISTINCT t ORDER BY t)
  FROM (
    SELECT unnest(c.types) AS t
    UNION
    SELECT CASE p.kind WHEN 'vente' THEN 'vendeur' ELSE 'acquereur' END
    FROM public.project_contacts pc
    JOIN public.projects p ON p.id = COALESCE(pc.opportunity_id, pc.buyer_criteria_id)
    WHERE pc.contact_id = c.id
  ) s(t)
  WHERE t IS NOT NULL
)
WHERE EXISTS (SELECT 1 FROM public.project_contacts pc WHERE pc.contact_id = c.id);

-- 3. Backfill "reseau" pour les contacts issus de la liste chaude
UPDATE public.contacts
SET types = array_append(types, 'reseau')
WHERE source = 'warm_contact' AND NOT ('reseau' = ANY (types));

-- 4. Integration du reseau restant (warm_contacts crees apres la migration 034)
DO $$
DECLARE
  rec record;
  p_contact_id uuid;
  p_first_name text;
  p_last_name text;
  names_array text[];
BEGIN
  FOR rec IN SELECT * FROM public.warm_contacts
  LOOP
    names_array := string_to_array(trim(rec.full_name), ' ');
    IF array_length(names_array, 1) > 1 THEN
      p_first_name := names_array[1];
      p_last_name := array_to_string(names_array[2:array_length(names_array, 1)], ' ');
    ELSE
      p_first_name := COALESCE(names_array[1], 'Inconnu');
      p_last_name := '';
    END IF;

    p_contact_id := NULL;
    IF rec.email IS NOT NULL AND rec.email <> '' THEN
      SELECT id INTO p_contact_id FROM public.contacts WHERE email = rec.email LIMIT 1;
    END IF;
    IF p_contact_id IS NULL AND rec.phone IS NOT NULL AND rec.phone <> '' THEN
      SELECT id INTO p_contact_id FROM public.contacts WHERE phone = rec.phone LIMIT 1;
    END IF;
    IF p_contact_id IS NULL THEN
      SELECT id INTO p_contact_id FROM public.contacts
      WHERE lower(first_name) = lower(p_first_name) AND lower(last_name) = lower(p_last_name) LIMIT 1;
    END IF;

    IF p_contact_id IS NULL THEN
      INSERT INTO public.contacts (first_name, last_name, email, phone, relation, source, types, created_at, updated_at)
      VALUES (p_first_name, p_last_name, NULLIF(rec.email, ''), NULLIF(rec.phone, ''), rec.relation, 'warm_contact', ARRAY['reseau']::text[], rec.created_at, rec.updated_at);
    ELSE
      UPDATE public.contacts
      SET types = CASE WHEN 'reseau' = ANY (types) THEN types ELSE array_append(types, 'reseau') END,
          relation = COALESCE(relation, rec.relation)
      WHERE id = p_contact_id;
    END IF;
  END LOOP;
END $$;

-- 5. Vue annuaire : typologies manuelles + typologies deduites des projets
CREATE OR REPLACE VIEW public.contacts_directory
WITH (security_invoker = on) AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company,
  c.relation,
  c.source,
  c.types,
  c.created_at,
  c.updated_at,
  COALESCE(
    (
      SELECT array_agg(DISTINCT t ORDER BY t)
      FROM (
        SELECT unnest(c.types) AS t
        UNION
        SELECT CASE p.kind WHEN 'vente' THEN 'vendeur' ELSE 'acquereur' END
        FROM public.project_contacts pc
        JOIN public.projects p ON p.id = COALESCE(pc.opportunity_id, pc.buyer_criteria_id)
        WHERE pc.contact_id = c.id
      ) s(t)
      WHERE t IS NOT NULL
    ),
    ARRAY[]::text[]
  ) AS all_types,
  (SELECT count(*) FROM public.project_contacts pc WHERE pc.contact_id = c.id) AS projects_count
FROM public.contacts c;

COMMENT ON VIEW public.contacts_directory IS 'Annuaire des contacts : all_types cumule les typologies saisies et celles deduites des projets rattaches.';

GRANT SELECT ON public.contacts_directory TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
