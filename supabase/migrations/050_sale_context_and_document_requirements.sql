-- 050 : contexte de vente et matrice documentaire.
--
-- Deux ajouts independants mais solidaires :
--   1. `projects.sale_context` — les faits qui decrivent la vente (type de bien,
--      regime, situation, caracteristiques techniques). C'est l'entree du moteur
--      de regles `src/lib/market/document-requirements.ts`.
--   2. `client_documents.requirement_key` — la cle stable qui relie une piece a
--      la regle qui l'a proposee, seule facon de rejouer le gabarit sans doublon.

-- ---------------------------------------------------------------------------
-- 1. Contexte de vente, porte par le projet
-- ---------------------------------------------------------------------------
--
-- Pourquoi une colonne dediee plutot que `property_snapshot` :
--   - `property_snapshot` part EN BLOC vers le portail vendeur
--     (`src/lib/client-portal-payload.ts`), or le contexte contient des
--     informations qui ne regardent pas le vendeur (divorce, indivision) ;
--   - `savePreparation()` le REMPLACE integralement a chaque enregistrement du
--     pre-mandat : tout champ ajoute hors du `PropertyDraft` y serait perdu.
--
-- La vue `public.opportunities` (migration 038) n'est volontairement PAS
-- etendue : ses triggers `INSTEAD OF` reecrivent une liste fermee de colonnes,
-- donc un UPDATE passant par la vue ne mentionne jamais `sale_context` dans son
-- SET et ne peut pas l'ecraser. La lecture et l'ecriture se font par
-- `/api/market/projects/[id]`, qui tape la table reelle.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sale_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.projects.sale_context IS
  'Contexte de vente versionne (voir src/lib/market/sale-context.ts). Jamais expose au portail vendeur.';

-- Permet « tous mes mandats en succession » sans scan complet.
CREATE INDEX IF NOT EXISTS projects_sale_context_gin
  ON public.projects USING gin (sale_context);

-- ---------------------------------------------------------------------------
-- 2. Cle de rattachement des pieces au referentiel
-- ---------------------------------------------------------------------------
--
-- Nullable a dessein : `client_documents` sert aussi aux dossiers acquereurs
-- (`/api/market/buyers/[id]/documents`), qui ignorent totalement le referentiel,
-- et le conseiller reste libre d'ajouter une piece hors gabarit.
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS requirement_key text;

COMMENT ON COLUMN public.client_documents.requirement_key IS
  'Cle de la regle DOCUMENT_REQUIREMENTS a l''origine de la piece. NULL = piece libre.';

-- Backfill conservateur, OBLIGATOIREMENT avant l'index unique.
--
-- On ne rattache que sur egalite stricte du libelle, et seulement si le couple
-- (dossier, cle) est unique — sinon l'index unique refuserait de se creer et
-- bloquerait la migration. La liste est volontairement courte : un backfill
-- incomplet est sans gravite (appliquer le gabarit recree la ligne manquante),
-- un index qui echoue est bloquant.
WITH mapping(label, key) AS (
  VALUES
    ('DPE', 'dpe'),
    ('Titre de propriété', 'titre_propriete'),
    ('Taxe foncière', 'taxe_fonciere'),
    ('Règlement de copropriété', 'reglement_copropriete')
),
candidates AS (
  SELECT
    d.id,
    m.key,
    count(*) OVER (PARTITION BY d.dossier_id, m.key) AS collisions
  FROM public.client_documents d
  JOIN mapping m ON m.label = d.label
  WHERE d.requirement_key IS NULL
)
UPDATE public.client_documents d
   SET requirement_key = c.key
  FROM candidates c
 WHERE c.id = d.id
   AND c.collisions = 1;

-- Une piece du referentiel au plus par dossier. Les pieces libres (NULL) restent
-- libres et peuvent se repeter.
CREATE UNIQUE INDEX IF NOT EXISTS client_documents_requirement_key_uniq
  ON public.client_documents (dossier_id, requirement_key)
  WHERE requirement_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_documents_requirement_key_idx
  ON public.client_documents (requirement_key)
  WHERE requirement_key IS NOT NULL;
