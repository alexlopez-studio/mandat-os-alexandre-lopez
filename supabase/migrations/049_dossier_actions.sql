-- ==============================================================================
-- 049_dossier_actions.sql
-- Les actions de preparation du mandat, en parallele du statut du projet.
--
-- Le suivi vendeur melangeait jusqu'ici trois natures dans un seul objet :
--
--   statut    lineaire, irreversible, un seul en cours a la fois
--             -> projete depuis le pipeline (`seller-milestones`, migration 048)
--   actions   paralleles, chacune son calendrier, cochables independamment
--             -> DPE, diagnostics, mesurage, shooting photo...
--   activite  du volume et de la recence
--             -> visites et offres, qui ont deja leurs types
--
-- Les actions ne sont pas des etapes : un DPE et un shooting photo ne se font
-- pas dans un ordre impose et n'avancent pas le dossier d'un cran. Les ranger
-- dans la chronologie les faisait passer pour des jalons sequentiels.
--
-- Tout l'outillage existe deja sur `client_dossier_events` : `status`
-- (todo/done/blocked/info, ou `blocked` dit « commande, en attente du
-- diagnostiqueur »), `event_date` pour une echeance facultative,
-- `visible_to_client` par ligne, `payload` pour le responsable. Seul le type
-- manquait.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Nouveau type d'evenement
-- ------------------------------------------------------------------------------
--
-- ADD VALUE est autorise dans une transaction depuis PostgreSQL 12 tant que la
-- valeur n'est pas *utilisee* dans la meme transaction : cette migration se
-- contente de la declarer.

ALTER TYPE public.client_dossier_event_type ADD VALUE IF NOT EXISTS 'action';

-- ------------------------------------------------------------------------------
-- 2. Purge des jalons orphelins
-- ------------------------------------------------------------------------------
--
-- Trois libelles repetes sur tous les dossiers, crees entre le 4 et le 12
-- juillet 2026 par du code retire depuis. Plus rien ne les alimente, le portail
-- est en lecture seule et aucune interface admin ne les faisait avancer : les
-- vendeurs regardaient deux etapes bloquees a « a faire » que personne ne
-- pouvait cocher.
--
--   « Dossier vendeur ouvert »    sans objet, le vendeur voit son dossier
--   « Avis de valeur conseiller » doublon du jalon « Estimation remise »
--   « Preparation des pieces »    ce n'etait pas une etape mais une action,
--                                 recreee proprement par le gabarit
--
-- Les visites, offres, notes et documents ne sont pas touches.

DELETE FROM public.client_dossier_events
WHERE type = 'milestone'
  AND visible_to_client
  AND title IN (
    'Dossier vendeur ouvert',
    'Avis de valeur conseiller',
    'Préparation des pièces'
  );
