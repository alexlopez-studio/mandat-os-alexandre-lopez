-- ==============================================================================
-- 045_joseph-regine-barjols.sql
-- Ajout des contacts vendeurs Joseph & Régine + projet vente à Barjols.
-- ==============================================================================

-- 1. Contacts
INSERT INTO public.contacts (first_name, last_name, source, types, status)
VALUES ('Joseph', '', 'manual', ARRAY['vendeur']::text[], 'client')
ON CONFLICT DO NOTHING;

INSERT INTO public.contacts (first_name, last_name, source, types, status)
VALUES ('Régine', '', 'manual', ARRAY['vendeur']::text[], 'client')
ON CONFLICT DO NOTHING;

-- 2. Projet vente
INSERT INTO public.projects (kind, title, stage, priority, property_city, description)
VALUES ('vente', 'Vente maison — Joseph & Régine — Barjols', 'prospection', 'normal', 'Barjols', 'Vente de la maison familiale à Barjols par Joseph et Régine.')
ON CONFLICT DO NOTHING;

-- 3. Rattachement contacts → projet
DO $$
DECLARE
  v_joseph_id uuid;
  v_regine_id uuid;
  v_project_id uuid;
BEGIN
  SELECT id INTO v_joseph_id FROM public.contacts WHERE first_name = 'Joseph' AND source = 'manual' LIMIT 1;
  SELECT id INTO v_regine_id FROM public.contacts WHERE first_name = 'Régine' AND source = 'manual' LIMIT 1;
  SELECT id INTO v_project_id FROM public.projects WHERE title LIKE '%Joseph & Régine — Barjols%' LIMIT 1;

  IF v_joseph_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    INSERT INTO public.project_contacts (contact_id, opportunity_id, role)
    VALUES (v_joseph_id, v_project_id, 'Vendeur')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_regine_id IS NOT NULL AND v_project_id IS NOT NULL THEN
    INSERT INTO public.project_contacts (contact_id, opportunity_id, role)
    VALUES (v_regine_id, v_project_id, 'Vendeur')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
