-- ═══════════════════════════════════════════════════════════════
-- 042 — File de validation des acquéreurs détectés par e-mail
--
-- Le scanner n'écrit plus directement dans `projects`. Il dépose un
-- candidat ici, qu'Alexandre valide ou rejette. Deux raisons :
--   1. une erreur d'analyse IA ne pollue plus le CRM de façon durable ;
--   2. les rejets sont conservés, ce qui donne de quoi mesurer la
--      précision de l'extraction sur de vrais e-mails.
--
-- `gmail_message_id` porte l'unicité : c'est lui qui rend le scan
-- idempotent, sans avoir à relire tout l'historique des `lead_events`.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.buyer_lead_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance Gmail
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text,
  received_at timestamptz,
  subject text,
  from_address text,
  portal text,
  -- Extrait du corps : de quoi trancher un cas douteux sans rouvrir Gmail.
  body_excerpt text,

  -- Sortie de l'analyse IA
  first_name text,
  last_name text,
  email text,
  phone text,
  property_type text,
  budget_max numeric,
  communes text[],
  -- Score rendu par le modèle, borné 0..1. Sert au tri de la file et,
  -- plus tard, à calibrer un éventuel seuil de création automatique.
  confidence numeric,
  -- Sortie brute du modèle, gardée telle quelle : sans elle, impossible
  -- de comprendre après coup pourquoi un candidat est mauvais.
  extraction jsonb,
  extracted_by text NOT NULL DEFAULT 'ai',

  -- Rattachement au bien concerné
  matched_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  match_reason text,

  -- Cycle de validation
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  review_note text,
  -- Renseigné à la validation : évite de recréer un projet si l'écran
  -- est rejoué deux fois.
  created_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- La file se lit toujours « en attente, plus récents d'abord ».
CREATE INDEX IF NOT EXISTS idx_buyer_lead_candidates_status
  ON public.buyer_lead_candidates(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyer_lead_candidates_matched_project
  ON public.buyer_lead_candidates(matched_project_id);

ALTER TABLE public.buyer_lead_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer lead candidates all for auth"
  ON public.buyer_lead_candidates FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER buyer_lead_candidates_updated_at
  BEFORE UPDATE ON public.buyer_lead_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
