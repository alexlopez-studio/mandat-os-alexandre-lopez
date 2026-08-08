-- ==============================================================================
-- 037_lot6_cleanup.sql
-- Lot 6 : Agent Telegram et nettoyage (retrait des vues de compatibilité)
-- ==============================================================================

-- 1. Mise à jour de project_contacts
ALTER TABLE public.project_contacts ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- Remplissage de project_id à partir des anciennes liaisons (les IDs ont été préservés)
UPDATE public.project_contacts
SET project_id = COALESCE(opportunity_id, buyer_criteria_id);

-- Vérification de sécurité : tous les project_contacts doivent avoir un project_id (sauf s'ils étaient liés à rien, mais c'est bloqué par le CHECK)
DELETE FROM public.project_contacts WHERE project_id IS NULL;

ALTER TABLE public.project_contacts ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.project_contacts DROP CONSTRAINT check_project_id;
ALTER TABLE public.project_contacts DROP COLUMN opportunity_id;
ALTER TABLE public.project_contacts DROP COLUMN buyer_criteria_id;

-- 2. Mise à jour de activities
ALTER TABLE public.activities ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- On migre les opportunités vers project_id (même ID)
UPDATE public.activities
SET project_id = opportunity_id
WHERE opportunity_id IS NOT NULL;

-- Pour les lead_id sur des critères d'achat, on cherche le projet correspondant
UPDATE public.activities a
SET project_id = p.id
FROM public.projects p
WHERE a.lead_id IS NOT NULL AND p.lead_id = a.lead_id AND p.kind = 'achat';

-- On supprime l'ancienne contrainte et on la remplace
ALTER TABLE public.activities DROP CONSTRAINT check_activity_target;
ALTER TABLE public.activities ADD CONSTRAINT check_activity_target CHECK (
  contact_id IS NOT NULL OR project_id IS NOT NULL OR lead_id IS NOT NULL
);

-- On ne garde pas opportunity_id
ALTER TABLE public.activities DROP COLUMN opportunity_id;

-- 3. Suppression des triggers et vues de compatibilité
DROP TRIGGER IF EXISTS instead_of_insert_opportunities ON public.opportunities;
DROP TRIGGER IF EXISTS instead_of_update_opportunities ON public.opportunities;
DROP TRIGGER IF EXISTS instead_of_delete_opportunities ON public.opportunities;
DROP FUNCTION IF EXISTS public.opportunities_insert_trigger();
DROP FUNCTION IF EXISTS public.opportunities_update_trigger();
DROP FUNCTION IF EXISTS public.opportunities_delete_trigger();
DROP VIEW IF EXISTS public.opportunities;

DROP TRIGGER IF EXISTS instead_of_insert_buyer_criteria ON public.buyer_criteria;
DROP TRIGGER IF EXISTS instead_of_update_buyer_criteria ON public.buyer_criteria;
DROP TRIGGER IF EXISTS instead_of_delete_buyer_criteria ON public.buyer_criteria;
DROP FUNCTION IF EXISTS public.buyer_criteria_insert_trigger();
DROP FUNCTION IF EXISTS public.buyer_criteria_update_trigger();
DROP FUNCTION IF EXISTS public.buyer_criteria_delete_trigger();
DROP VIEW IF EXISTS public.buyer_criteria;

-- 4. Suppression des tables obsolètes
-- Les tables legacy_opportunities et legacy_buyer_criteria ont conservé leurs données, 
-- mais toutes les données utiles ont été migrées vers projects dans le lot 4 (036_projects_unified).
DROP TABLE IF EXISTS public.legacy_opportunities CASCADE;
DROP TABLE IF EXISTS public.legacy_buyer_criteria CASCADE;
