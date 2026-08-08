-- ==============================================================================
-- 034_unified_contacts.sql
-- Lot 1 : Modèle Contact / Projet - La personne devient réelle.
-- ==============================================================================

-- 1. Table contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email citext,
  phone text,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_email ON public.contacts (email);
CREATE INDEX idx_contacts_phone ON public.contacts (phone);
CREATE INDEX idx_contacts_name ON public.contacts (lower(first_name), lower(last_name));

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Table project_contacts
CREATE TABLE public.project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  buyer_criteria_id uuid REFERENCES public.buyer_criteria(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_project_id CHECK (
    (opportunity_id IS NOT NULL AND buyer_criteria_id IS NULL) OR
    (buyer_criteria_id IS NOT NULL AND opportunity_id IS NULL)
  )
);

CREATE INDEX idx_project_contacts_contact ON public.project_contacts(contact_id);
CREATE INDEX idx_project_contacts_opp ON public.project_contacts(opportunity_id);
CREATE INDEX idx_project_contacts_buyer ON public.project_contacts(buyer_criteria_id);

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER project_contacts_updated_at
  BEFORE UPDATE ON public.project_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (temporaire, on autorise tout pour les requêtes authentifiées, l'admin bypass de toute façon)
CREATE POLICY "Contacts all for auth" ON public.contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "ProjectContacts all for auth" ON public.project_contacts FOR ALL USING (auth.role() = 'authenticated');


-- 3. ETL (Reprise des données)
DO $$
DECLARE
  rec record;
  p_contact_id uuid;
  p_first_name text;
  p_last_name text;
  names_array text[];
BEGIN

  -- A. Reprise des PROSPECTS
  FOR rec IN SELECT * FROM public.prospects
  LOOP
    INSERT INTO public.contacts (id, first_name, last_name, email, phone, source, created_at, updated_at)
    VALUES (rec.id, rec.first_name, rec.last_name, rec.email, rec.phone, 'prospect', rec.created_at, rec.updated_at)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- B. Reprise des CLIENT_PROFILES
  -- Les client_profiles ont un id différent, on essaie de matcher par email sinon on crée
  FOR rec IN SELECT * FROM public.client_profiles
  LOOP
    SELECT id INTO p_contact_id FROM public.contacts WHERE email = rec.email LIMIT 1;
    IF p_contact_id IS NULL THEN
      INSERT INTO public.contacts (first_name, last_name, email, phone, source, created_at, updated_at)
      VALUES (rec.first_name, rec.last_name, rec.email, rec.phone, 'client_profile', rec.created_at, rec.updated_at);
    END IF;
  END LOOP;

  -- C. Reprise des WARM_CONTACTS
  FOR rec IN SELECT * FROM public.warm_contacts
  LOOP
    -- Split full_name
    names_array := string_to_array(trim(rec.full_name), ' ');
    IF array_length(names_array, 1) > 1 THEN
      p_first_name := names_array[1];
      p_last_name := array_to_string(names_array[2:array_length(names_array, 1)], ' ');
    ELSE
      p_first_name := COALESCE(names_array[1], 'Inconnu');
      p_last_name := '';
    END IF;

    -- Match by email or phone or name
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
      INSERT INTO public.contacts (first_name, last_name, email, phone, source, created_at, updated_at)
      VALUES (p_first_name, p_last_name, rec.email, rec.phone, 'warm_contact', rec.created_at, rec.updated_at);
    END IF;
  END LOOP;

  -- D. Reprise des OPPORTUNITIES (Vente)
  FOR rec IN SELECT * FROM public.opportunities WHERE seller_name IS NOT NULL AND trim(seller_name) <> ''
  LOOP
    names_array := string_to_array(trim(rec.seller_name), ' ');
    IF array_length(names_array, 1) > 1 THEN
      p_first_name := names_array[1];
      p_last_name := array_to_string(names_array[2:array_length(names_array, 1)], ' ');
    ELSE
      p_first_name := COALESCE(names_array[1], 'Inconnu');
      p_last_name := '';
    END IF;

    p_contact_id := NULL;
    IF rec.seller_email IS NOT NULL AND trim(rec.seller_email) <> '' THEN
      SELECT id INTO p_contact_id FROM public.contacts WHERE email = rec.seller_email LIMIT 1;
    END IF;
    IF p_contact_id IS NULL AND rec.seller_phone IS NOT NULL AND trim(rec.seller_phone) <> '' THEN
      SELECT id INTO p_contact_id FROM public.contacts WHERE phone = rec.seller_phone LIMIT 1;
    END IF;
    IF p_contact_id IS NULL THEN
      SELECT id INTO p_contact_id FROM public.contacts 
      WHERE lower(first_name) = lower(p_first_name) AND lower(last_name) = lower(p_last_name) LIMIT 1;
    END IF;

    IF p_contact_id IS NULL THEN
      INSERT INTO public.contacts (first_name, last_name, email, phone, source, created_at, updated_at)
      VALUES (p_first_name, p_last_name, rec.seller_email, rec.seller_phone, 'opportunity', rec.created_at, rec.updated_at)
      RETURNING id INTO p_contact_id;
    END IF;

    -- Lier au projet
    INSERT INTO public.project_contacts (contact_id, opportunity_id, role)
    VALUES (p_contact_id, rec.id, 'Vendeur unique');
  END LOOP;

  -- E. Reprise des BUYER_CRITERIA (Achat)
  FOR rec IN SELECT bc.*, l.prospect_id as lead_prospect_id 
             FROM public.buyer_criteria bc 
             LEFT JOIN public.leads l ON bc.lead_id::text = l.id::text
  LOOP
    -- On cherche le contact via prospect_id
    p_contact_id := COALESCE(rec.prospect_id::uuid, rec.lead_prospect_id::uuid);
    IF p_contact_id IS NOT NULL THEN
      INSERT INTO public.project_contacts (contact_id, buyer_criteria_id, role)
      VALUES (p_contact_id, rec.id, 'Acquéreur');
    END IF;
  END LOOP;

END $$;
