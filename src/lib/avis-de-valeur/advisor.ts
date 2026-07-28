import type { AdvisorData } from './types'

/**
 * Constantes conseiller.
 *
 * Volontairement hors base : ce sont des mentions réglementaires et des
 * coordonnées de carte de visite, pas des données métier. Les mettre en base
 * reviendrait à autoriser leur modification sans relecture.
 */
export const ADVISOR: AdvisorData = {
  name: 'Alexandre Lopez',
  title: 'Conseiller en immobilier',
  // Charte iad : espaces, jamais de points.
  phone: '06 13 18 01 68',
  email: 'alexandre.lopez@iadfrance.fr',
  sector: 'Provence Verte & Verdon (83)',
  rsac: 'RSAC de Draguignan n° 908 906 423',
  miniSite: 'https://www.iadfrance.fr/conseiller-immobilier/alexandre.lopez',
  instagram: 'https://www.instagram.com/alexandrelopez_iad/',
  digitalCard: 'https://card.pm/iad/662cd5c',
  photoUrl: '/alexandre-lopez.jpg',
}

/** Mentions légales obligatoires, pied de dernière page. */
export const LEGAL_MENTION =
  'EI Alexandre Lopez, mandataire indépendant en immobilier (sans détention de fonds), agent commercial ' +
  'de la SAS I@D France immatriculé au RSAC de Draguignan sous le numéro 908 906 423, titulaire de la ' +
  'carte de démarchage immobilier pour le compte de la société I@D France SAS.'

/** Obligatoire dès que le mot « conseiller » apparaît hors carte de visite. */
export const ADVISOR_MENTION =
  'Conseiller : tous les conseillers iad sont des agents commerciaux indépendants (sans détention de fonds) ' +
  'de la SAS I@D France immatriculés au RSAC, titulaires de la carte de démarchage immobilier pour le compte ' +
  'de la société I@D France.'

/** Renvoi systématique : le rapport informe, il ne conseille pas fiscalement. */
export const NOTARY_DISCLAIMER =
  'Les montants fiscaux présentés sont des ordres de grandeur. Seul le notaire chargé de la vente est ' +
  'habilité à les arrêter.'

export const DVF_SOURCE_LABEL = 'Source : DVF — Demandes de valeurs foncières (DGFiP), mutations réellement signées.'

export const LISTINGS_SOURCE_LABEL = 'Source : annonces en ligne relevées sur le secteur — prix demandés, non signés.'
