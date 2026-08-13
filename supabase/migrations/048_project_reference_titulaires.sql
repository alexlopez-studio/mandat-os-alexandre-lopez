-- ==============================================================================
-- 048_project_reference_titulaires.sql
-- Nomenclature des projets : reference prononcable + titulaires du titre.
--
-- Deux notions distinctes, que le seul champ `title` melangeait jusqu'ici :
--
--   reference      "26-042"             identite, figee a la creation, jamais
--                                       recalculee. Sert a l'oral, dans les
--                                       mails et sur les documents remis.
--   display_title  "MARTIN - Brignoles" affichage, recalcule a chaque lecture
--                                       depuis les contacts rattaches.
--
-- La reference est un compteur remis a zero chaque annee : le volume annuel
-- tient sur trois chiffres, donc la reference reste courte et prononcable a
-- vie, la ou un compteur global finirait a "1487".
--
-- Le titre, lui, ne retient que les contacts qui figurent sur le titre de
-- propriete (vente) ou qui signeront l'acte (achat). `role` est du texte libre
-- valant 'Contact' par defaut : il ne peut pas servir de critere, sans quoi le
-- notaire rattache au dossier remonterait dans le titre.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Compteur de references, une ligne par annee
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_reference_counters (
  year integer PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.project_reference_counters IS
  'Dernier numero attribue par annee. Une ligne verrouillee par allocation : la creation de projets est serialisee, ce qui est sans effet a ce volume.';

-- Allocation atomique : le ON CONFLICT DO UPDATE verrouille la ligne de
-- l'annee, deux creations simultanees ne peuvent pas obtenir le meme numero.
CREATE OR REPLACE FUNCTION public.allocate_project_reference(p_year integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq integer;
BEGIN
  INSERT INTO public.project_reference_counters AS c (year, last_seq)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_seq = c.last_seq + 1
  RETURNING c.last_seq INTO v_seq;

  -- FM00 / FM000 : pas d'espace de signe, largeur fixe. Au-dela de 999 le
  -- numero deborde proprement sur quatre chiffres au lieu d'etre tronque.
  RETURN to_char(p_year % 100, 'FM00') || '-' || to_char(v_seq, 'FM000');
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Colonne `reference` et attribution automatique
-- ------------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS reference text;

COMMENT ON COLUMN public.projects.reference IS
  'Reference prononcable "AA-NNN" (annee sur 2 chiffres, sequence remise a zero chaque annee). Attribuee a la creation, jamais recalculee.';

-- Les projets sont crees par plusieurs chemins (UI, sync playiad, telegram, et
-- les vues `opportunities` / `buyer_criteria` avec leur INSTEAD OF INSERT).
-- Un trigger sur la table garantit la reference quel que soit le chemin.
CREATE OR REPLACE FUNCTION public.set_project_reference()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' THEN
    NEW.reference := public.allocate_project_reference(
      EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::integer
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_set_reference ON public.projects;
CREATE TRIGGER trg_projects_set_reference
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_reference();

-- ------------------------------------------------------------------------------
-- 3. Backfill des projets existants, dans l'ordre de creation de chaque annee
-- ------------------------------------------------------------------------------

WITH numbered AS (
  SELECT
    id,
    EXTRACT(YEAR FROM COALESCE(created_at, now()))::integer AS ref_year,
    row_number() OVER (
      PARTITION BY EXTRACT(YEAR FROM COALESCE(created_at, now()))
      ORDER BY created_at NULLS LAST, id
    ) AS seq
  FROM public.projects
  WHERE reference IS NULL
)
UPDATE public.projects p
SET reference = to_char(n.ref_year % 100, 'FM00') || '-' || to_char(n.seq, 'FM000')
FROM numbered n
WHERE p.id = n.id;

-- Le compteur repart au-dessus du dernier numero attribue par le backfill.
INSERT INTO public.project_reference_counters AS c (year, last_seq)
SELECT
  EXTRACT(YEAR FROM COALESCE(created_at, now()))::integer,
  count(*)::integer
FROM public.projects
GROUP BY 1
ON CONFLICT (year) DO UPDATE
  SET last_seq = GREATEST(c.last_seq, EXCLUDED.last_seq);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_reference
  ON public.projects (reference);

ALTER TABLE public.projects
  ALTER COLUMN reference SET NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. Titulaires : qui figure dans le titre du projet
-- ------------------------------------------------------------------------------

ALTER TABLE public.project_contacts
  ADD COLUMN IF NOT EXISTS is_titulaire boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_contacts.is_titulaire IS
  'Le contact figure sur le titre de propriete (vente) ou signera l''acte (achat). Seuls les titulaires composent le titre affiche du projet ; `role` reste libre et purement descriptif.';

-- Backfill 1 : les roles deja explicites.
UPDATE public.project_contacts
SET is_titulaire = true
WHERE role IS NOT NULL
  AND lower(role) ~ 'vendeur|vendeuse|acqu|achet|propri|indivis';

-- Backfill 2 : les projets sans aucun titulaire identifie gardent leur contact
-- principal (le plus ancien lien), ce qui reproduit le titre affiche jusqu'ici.
-- A relire dossier par dossier : le lien le plus ancien n'est pas toujours un
-- proprietaire.
UPDATE public.project_contacts pc
SET is_titulaire = true
WHERE pc.id IN (
  SELECT DISTINCT ON (COALESCE(opportunity_id, buyer_criteria_id)) id
  FROM public.project_contacts outer_pc
  WHERE COALESCE(opportunity_id, buyer_criteria_id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_contacts sibling
      WHERE COALESCE(sibling.opportunity_id, sibling.buyer_criteria_id)
            = COALESCE(outer_pc.opportunity_id, outer_pc.buyer_criteria_id)
        AND sibling.is_titulaire
    )
  ORDER BY COALESCE(opportunity_id, buyer_criteria_id), created_at, id
);

-- L'ordre des titulaires dans le titre doit etre stable : sans ORDER BY,
-- Postgres reordonne les lignes au gre des mises a jour et "MARTIN / DUPONT"
-- devient "DUPONT / MARTIN" tout seul. L'index sert l'ordre retenu.
CREATE INDEX IF NOT EXISTS idx_project_contacts_opp_order
  ON public.project_contacts (opportunity_id, created_at, id)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_contacts_buyer_order
  ON public.project_contacts (buyer_criteria_id, created_at, id)
  WHERE buyer_criteria_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. Vues de compatibilite (migration 038) : exposer la reference
-- ------------------------------------------------------------------------------
--
-- Les deux vues ont une projection explicite : sans cette reprise, la colonne
-- resterait invisible depuis `opportunities` / `buyer_criteria`, ou vit encore
-- une partie de l'interface. `reference` est ajoutee en fin de projection, seule
-- position acceptee par CREATE OR REPLACE VIEW.
--
-- Les triggers INSTEAD OF UPDATE ne touchent pas a la colonne : la reference est
-- figee, et c'est le comportement voulu.

CREATE OR REPLACE VIEW public.opportunities AS
SELECT
  id, market_property_id, lead_id, title, description, stage, priority,
  signal_type, next_action, due_date, note, seller_name, seller_phone, seller_email,
  source_channel, property_address, property_city, property_zipcode, property_type,
  property_surface, property_land_surface, property_rooms, estimated_price_min,
  estimated_price_max, selling_timeline, pre_estimation_done_at, visit_at,
  report_delivered_at, follow_up_at, property_snapshot, professional_opinion,
  internal_intel, created_from, is_test, created_at, updated_at, reference
FROM public.projects
WHERE kind = 'vente';

CREATE OR REPLACE VIEW public.buyer_criteria AS
SELECT
  id, lead_id, prospect_id, type_bien, communes, budget_max, surface_min, pieces_min,
  criteres, active, stage, next_action, due_date, matched_at, created_at, updated_at,
  reference
FROM public.projects
WHERE kind = 'achat';
