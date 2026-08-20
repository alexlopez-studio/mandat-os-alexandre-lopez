/**
 * Matrice documentaire — quelles pieces reunir pour vendre CE bien-la.
 *
 * Module pur, importable des deux cotes, sur le modele de `seller-actions.ts`.
 *
 * Une regle est integralement declarative : ses conditions ne sont pas des
 * fonctions mais des listes de chaines, ce qui la rend serialisable en JSON.
 * Le jour ou le referentiel devra etre editable sans deploiement, il suffira de
 * remplacer l'import par un `select` — le moteur, lui, ne bougera pas.
 *
 * Avertissement : ce referentiel encode le droit francais courant de la vente
 * immobiliere. Il est une aide a la preparation, pas un avis juridique — le
 * notaire reste seul juge de la composition definitive du dossier.
 */

import {
  MARKETING_VISITS_STAGE,
  PROMISE_SIGNED_STAGE,
  SIGNED_MANDATE_STAGE,
  SOLD_STAGE,
  type SellerStage,
} from './seller-stages'
import type { SaleContext, PropertyTypeKey } from './sale-context'
import { deriveSaleFlags, type SaleFlag } from './sale-flags'
import type { SellerActionResponsible } from './seller-actions'

/**
 * Vocabulaire unique des categories de pieces.
 *
 * Vit ici plutot que dans `DossierWorkspace.tsx` (composant `'use client'`, donc
 * inimportable par les routes API) : trois vocabulaires concurrents coexistaient
 * deja dans l'application, un quatrieme aurait ete de trop. Un test d'invariant
 * garantit qu'aucune regle n'introduit de categorie hors de cette liste.
 */
export const DOCUMENT_CATEGORY_OPTIONS = [
  'Propriété',
  'Identité',
  'Diagnostics',
  'Fiscalité',
  'Urbanisme',
  'Copropriété',
  'Travaux',
  'Assainissement',
  'Mandat',
  'Autre',
] as const

export type RequirementCategory = (typeof DOCUMENT_CATEGORY_OPTIONS)[number]

/**
 * Conditions d'application. Un champ absent = aucune contrainte sur cet axe.
 * Les axes se combinent en ET, les valeurs a l'interieur d'un axe en OU (sauf
 * `requires`, qui exige la presence de tous ses drapeaux).
 */
export type RequirementCondition = {
  propertyTypes?: PropertyTypeKey[]
  excludePropertyTypes?: PropertyTypeKey[]
  requires?: SaleFlag[]
  requiresAny?: SaleFlag[]
  excludes?: SaleFlag[]
}

export type RequirementSeverity = 'obligatoire' | 'recommande' | 'selon_cas'

export type DocumentRequirement = {
  /** Cle stable, ecrite en base. Ne jamais la renommer ni la reutiliser. */
  key: string
  /** Libelle lu par le vendeur — il atterrit dans `client_documents.label`. */
  label: string
  description: string
  severity: RequirementSeverity
  /** Stade a partir duquel la piece devient bloquante (cf. `seller-stages`). */
  dueStage: SellerStage
  legalRef?: string
  validity?: string
  appliesTo: RequirementCondition
  produces: {
    document?: { category: RequirementCategory }
    action?: { title: string; responsible: SellerActionResponsible }
  }
  /**
   * Regle reconnue pour ne pas dupliquer l'existant, mais jamais reproposee.
   * Sert a accueillir les lignes deja en base sur les dossiers en cours.
   */
  deprecated?: true
}

/**
 * Regle editoriale des deux volets — c'est elle qui evite au vendeur de voir
 * trente doublons entre sa liste d'actions et sa liste de pieces :
 *
 *   `produces.action` n'existe QUE s'il y a une demarche d'obtention reelle
 *   (commander un diagnostic, reclamer une piece au syndic, faire venir un
 *   geometre). Les pieces que le vendeur detient deja — titre de propriete,
 *   taxe fonciere, livret de famille — n'ont que le volet `document`.
 *
 * L'action « Commander le DPE » et la piece « DPE » portent la meme cle : ce
 * sont deux moments du meme objet, pas deux objets.
 */
export const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  // ---------------------------------------------------------------------
  // Socle — toute vente, quel que soit le bien
  // ---------------------------------------------------------------------
  {
    key: 'titre_propriete',
    label: 'Titre de propriété',
    description: "Acte d'acquisition ou attestation notariée établissant que le vendeur est bien propriétaire.",
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'piece_identite',
    label: "Pièce d'identité du ou des vendeurs",
    description: 'Carte nationale d’identité ou passeport en cours de validité, pour chaque vendeur.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'situation_matrimoniale',
    label: 'Justificatif de situation matrimoniale',
    description: 'Livret de famille, contrat de mariage ou convention de PACS — il détermine qui doit signer.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'justificatif_domicile',
    label: 'Justificatif de domicile',
    description: 'Facture de moins de trois mois, demandée par le notaire.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'rib_vendeur',
    label: 'RIB du vendeur',
    description: 'Pour le virement du prix de vente le jour de la signature.',
    severity: 'obligatoire',
    dueStage: SOLD_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'taxe_fonciere',
    label: 'Dernier avis de taxe foncière',
    description: "Information obligatoire de l'acquéreur, et base du prorata calculé chez le notaire.",
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: {},
    produces: { document: { category: 'Fiscalité' } },
  },
  {
    key: 'erp',
    label: 'État des risques et pollutions (ERP)',
    description: "À joindre dès l'annonce. Établi à partir de l'état des risques de la commune.",
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.125-5 code de l’environnement',
    validity: '6 mois',
    // Inconditionnel a dessein : l'ERP depend d'un PPRN/PPRT, d'une sismicite
    // >= 2, d'un potentiel radon 3 ou d'un SIS — soit, en pratique, la
    // quasi-totalite du territoire et l'integralite de la Provence Verte. Le
    // conditionner, ce serait l'oublier la fois ou il compte.
    appliesTo: {},
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: "Commander l'état des risques (ERP)", responsible: 'seller' },
    },
  },
  {
    key: 'mandat_signe',
    label: 'Mandat de vente signé',
    description: 'Exemplaire signé du mandat, numéroté au registre des mandats.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: {},
    produces: {
      document: { category: 'Mandat' },
      action: { title: 'Faire signer le mandat', responsible: 'advisor' },
    },
  },
  {
    key: 'shooting',
    label: 'Shooting photo',
    description: 'Reportage photo professionnel du bien, préalable à la diffusion.',
    severity: 'recommande',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: {},
    produces: { action: { title: 'Shooting photo', responsible: 'advisor' } },
  },
  {
    key: 'visuels',
    label: 'Mise en ligne des visuels',
    description: 'Publication des photos et du descriptif sur les portails de diffusion.',
    severity: 'recommande',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: {},
    produces: { action: { title: 'Mise en ligne des visuels', responsible: 'advisor' } },
  },

  // ---------------------------------------------------------------------
  // Bati — tout sauf un terrain nu
  // ---------------------------------------------------------------------
  {
    key: 'dpe',
    label: 'DPE',
    description: "Diagnostic de performance énergétique, obligatoire dès la mise en ligne de l'annonce.",
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.126-26 CCH',
    validity: '10 ans',
    appliesTo: { excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le DPE', responsible: 'seller' },
    },
  },
  {
    key: 'audit_energetique',
    label: 'Audit énergétique réglementaire',
    description: 'Exigible pour les logements classés E, F ou G en monopropriété.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.126-28-1 CCH',
    validity: '5 ans',
    // Ne concerne que les maisons et immeubles entiers : un lot de copropriete
    // en est dispense, l'audit portant sur le batiment complet.
    appliesTo: { requires: ['dpe_passoire'], excludes: ['copropriete'], propertyTypes: ['maison', 'immeuble'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: "Commander l'audit énergétique", responsible: 'seller' },
    },
  },
  {
    key: 'amiante',
    label: "État d'amiante",
    description: 'Exigible si le permis de construire a été délivré avant le 1er juillet 1997.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. R.1334-15 code de la santé publique',
    validity: 'Illimitée si absence constatée après 2013',
    appliesTo: { requires: ['permis_avant_1997'], excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le diagnostic amiante', responsible: 'seller' },
    },
  },
  {
    key: 'crep',
    label: 'Constat de risque d’exposition au plomb (CREP)',
    description: 'Exigible si le permis de construire est antérieur au 1er janvier 1949.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.1334-5 code de la santé publique',
    validity: '1 an si positif, illimitée si négatif',
    appliesTo: { requires: ['permis_avant_1949'], excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le diagnostic plomb', responsible: 'seller' },
    },
  },
  {
    key: 'diagnostic_electricite',
    label: 'Diagnostic électricité',
    description: 'Exigible si l’installation intérieure a plus de quinze ans.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    validity: '3 ans',
    appliesTo: { requires: ['elec_a_diagnostiquer'], excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le diagnostic électricité', responsible: 'seller' },
    },
  },
  {
    key: 'diagnostic_gaz',
    label: 'Diagnostic gaz',
    description: 'Exigible si l’installation intérieure de gaz a plus de quinze ans.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    validity: '3 ans',
    appliesTo: { requires: ['gaz_a_diagnostiquer'], excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le diagnostic gaz', responsible: 'seller' },
    },
  },
  {
    key: 'termites',
    label: 'État relatif à la présence de termites',
    description: 'Exigible dans les communes couvertes par un arrêté préfectoral de zone contaminée.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.133-6 CCH',
    validity: '6 mois',
    appliesTo: { requires: ['zone_termites'], excludePropertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Commander le diagnostic termites', responsible: 'seller' },
    },
  },
  {
    key: 'merule',
    label: 'Information sur la mérule',
    description: "Information de l'acquéreur en zone à risque — il s'agit d'une déclaration, non d'un diagnostic.",
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.126-9 CCH',
    appliesTo: { requires: ['zone_merule'], excludePropertyTypes: ['terrain'] },
    produces: { document: { category: 'Diagnostics' } },
  },
  {
    key: 'bruit_aerien',
    label: "État des nuisances sonores aériennes",
    description: 'Exigible pour un bien situé dans une zone de plan d’exposition au bruit.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.112-11 code de l’urbanisme',
    appliesTo: { requires: ['zone_bruit_aerien'], excludePropertyTypes: ['terrain'] },
    produces: { document: { category: 'Diagnostics' } },
  },
  {
    key: 'carrez',
    label: 'Mesurage Carrez',
    description: 'Obligatoire pour tout lot de copropriété : la surface privative doit figurer à l’acte.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. 46 loi du 10 juillet 1965',
    validity: 'Illimitée en l’absence de travaux',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Diagnostics' },
      action: { title: 'Faire réaliser le mesurage Carrez', responsible: 'seller' },
    },
  },

  // ---------------------------------------------------------------------
  // Assainissement
  // ---------------------------------------------------------------------
  {
    key: 'spanc',
    label: "Contrôle d'assainissement non collectif (SPANC)",
    description: 'Rapport de visite du service public d’assainissement non collectif.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.1331-11-1 code de la santé publique',
    validity: '3 ans',
    appliesTo: { requires: ['assainissement_non_collectif'] },
    produces: {
      document: { category: 'Assainissement' },
      action: { title: 'Demander le contrôle SPANC', responsible: 'seller' },
    },
  },
  {
    key: 'conformite_raccordement',
    label: 'Certificat de conformité du raccordement',
    description: 'Exigé par certains règlements communaux pour un raccordement au tout-à-l’égout.',
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['assainissement_collectif'] },
    produces: { document: { category: 'Assainissement' } },
  },

  // ---------------------------------------------------------------------
  // Copropriete
  // ---------------------------------------------------------------------
  {
    key: 'reglement_copropriete',
    label: 'Règlement de copropriété et état descriptif de division',
    description: 'Avec ses modificatifs publiés. À demander au syndic si le vendeur ne l’a plus.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.721-2 CCH',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Demander le règlement de copropriété au syndic', responsible: 'seller' },
    },
  },
  {
    key: 'fiche_synthetique',
    label: 'Fiche synthétique de la copropriété',
    description: 'Document de synthèse tenu à jour par le syndic.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. 8-2 loi du 10 juillet 1965',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Demander la fiche synthétique au syndic', responsible: 'seller' },
    },
  },
  {
    key: 'pv_ag_3_ans',
    label: 'Procès-verbaux des trois dernières assemblées générales',
    description: 'Annexés à la promesse de vente. Ils révèlent les travaux votés et les litiges en cours.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.721-2 CCH',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Demander les PV d’AG au syndic', responsible: 'seller' },
    },
  },
  {
    key: 'carnet_entretien',
    label: "Carnet d'entretien de l'immeuble",
    description: 'Historique des travaux réalisés sur les parties communes.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.721-2 CCH',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Demander le carnet d’entretien au syndic', responsible: 'seller' },
    },
  },
  {
    key: 'pre_etat_date',
    label: 'Pré-état daté',
    description: 'Situation financière du lot vis-à-vis de la copropriété, à annexer à la promesse.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Commander le pré-état daté au syndic', responsible: 'seller' },
    },
  },
  {
    key: 'etat_date',
    label: 'État daté',
    description: 'Établi par le syndic pour la signature de l’acte authentique. Payant.',
    severity: 'obligatoire',
    dueStage: SOLD_STAGE,
    legalRef: 'Art. 5 décret du 17 mars 1967',
    appliesTo: { requires: ['copropriete'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: "Commander l'état daté au syndic", responsible: 'seller' },
    },
  },
  {
    key: 'charges_copropriete',
    label: 'Appels de fonds des deux derniers exercices',
    description: 'Montant des charges courantes, information obligatoire de l’acquéreur.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { requires: ['copropriete'] },
    produces: { document: { category: 'Copropriété' } },
  },
  {
    key: 'dtg_ppt',
    label: 'Diagnostic technique global ou plan pluriannuel de travaux',
    description: 'Selon la taille et l’âge de la copropriété, avec le montant du fonds de travaux.',
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['copropriete'] },
    produces: { document: { category: 'Copropriété' } },
  },
  {
    key: 'dta_parties_communes',
    label: 'Dossier technique amiante des parties communes',
    description: 'Exigible pour un immeuble dont le permis est antérieur au 1er juillet 1997.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['copropriete', 'permis_avant_1997'] },
    produces: {
      document: { category: 'Copropriété' },
      action: { title: 'Demander le DTA au syndic', responsible: 'seller' },
    },
  },

  // ---------------------------------------------------------------------
  // Travaux recents (moins de dix ans, soumis a decennale)
  // ---------------------------------------------------------------------
  {
    key: 'permis_da',
    label: 'Permis de construire ou déclaration préalable',
    description: 'Autorisation d’urbanisme des travaux réalisés, avec le récépissé de dépôt.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['travaux_recents'] },
    produces: { document: { category: 'Urbanisme' } },
  },
  {
    key: 'daact',
    label: 'DAACT et certificat de non-contestation',
    description: 'Déclaration attestant l’achèvement et la conformité des travaux, délivrée par la mairie.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['travaux_recents'] },
    produces: {
      document: { category: 'Urbanisme' },
      action: { title: 'Demander le certificat de non-contestation en mairie', responsible: 'seller' },
    },
  },
  {
    key: 'assurance_do',
    label: 'Assurance dommages-ouvrage',
    description: 'La garantie décennale se transmet à l’acquéreur : son absence est un point dur en négociation.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.242-1 code des assurances',
    appliesTo: { requires: ['travaux_recents'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'decennales_entreprises',
    label: 'Attestations décennales des entreprises',
    description: 'Une attestation par entreprise intervenue sur les travaux.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['travaux_recents'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'factures_travaux',
    label: 'Factures des travaux',
    description: 'Utiles pour justifier la plus-value et rassurer l’acquéreur sur la qualité des ouvrages.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['travaux_recents'] },
    produces: { document: { category: 'Travaux' } },
  },

  // ---------------------------------------------------------------------
  // Equipements
  // ---------------------------------------------------------------------
  {
    key: 'securite_piscine',
    label: 'Attestation du dispositif de sécurité de la piscine',
    description: 'Barrière, alarme, couverture ou abri conforme aux normes en vigueur.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    legalRef: 'Art. L.128-1 CCH',
    appliesTo: { requires: ['piscine'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'conformite_veranda',
    label: 'Autorisation d’urbanisme de la véranda',
    description: 'Déclaration préalable ou permis, selon la surface créée.',
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['veranda'] },
    produces: { document: { category: 'Urbanisme' } },
  },
  {
    key: 'ramonage_cheminee',
    label: 'Certificat de ramonage',
    description: 'Dernier ramonage de la cheminée ou du conduit de l’insert.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['cheminee'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'contrat_raccordement_solaire',
    label: 'Contrat de raccordement et de rachat photovoltaïque',
    description: 'Contrat en cours et convention de raccordement, à transférer à l’acquéreur.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['panneaux_solaires'] },
    produces: { document: { category: 'Travaux' } },
  },

  // ---------------------------------------------------------------------
  // Terrain
  // ---------------------------------------------------------------------
  {
    key: 'certificat_urbanisme',
    label: "Certificat d'urbanisme opérationnel",
    description: 'Il précise la constructibilité du terrain et les droits attachés à la parcelle.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    validity: '18 mois',
    appliesTo: { propertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Urbanisme' },
      action: { title: "Demander le certificat d'urbanisme en mairie", responsible: 'advisor' },
    },
  },
  {
    key: 'bornage_lotissement',
    label: 'Procès-verbal de bornage',
    description: 'Obligatoire pour la vente d’un lot issu d’un lotissement.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Art. L.115-4 code de l’urbanisme',
    appliesTo: { requires: ['lotissement'] },
    produces: {
      document: { category: 'Propriété' },
      action: { title: 'Faire borner le terrain par un géomètre', responsible: 'seller' },
    },
  },
  {
    key: 'bornage_terrain',
    label: 'Bornage du terrain',
    description: 'Non obligatoire hors lotissement, mais il sécurise les limites et évite les litiges.',
    severity: 'recommande',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { propertyTypes: ['terrain'], excludes: ['lotissement'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'etude_sol_g1',
    label: 'Étude géotechnique préalable (G1)',
    description: 'Obligatoire pour la vente d’un terrain constructible en zone d’argile.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    legalRef: 'Loi ELAN, art. L.132-4 CCH',
    validity: '30 ans',
    appliesTo: { requires: ['zone_argile'], propertyTypes: ['terrain'] },
    produces: {
      document: { category: 'Urbanisme' },
      action: { title: 'Commander l’étude de sol G1', responsible: 'seller' },
    },
  },
  {
    key: 'viabilisation',
    label: 'Justificatifs de viabilisation',
    description: 'Raccordements eau, électricité et assainissement existants ou devis de raccordement.',
    severity: 'recommande',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { propertyTypes: ['terrain'] },
    produces: { document: { category: 'Urbanisme' } },
  },

  // ---------------------------------------------------------------------
  // Situation — succession
  // ---------------------------------------------------------------------
  {
    key: 'acte_notoriete',
    label: 'Acte de notoriété',
    description: 'Établi par le notaire, il désigne les héritiers habilités à vendre.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['succession'] },
    produces: {
      document: { category: 'Propriété' },
      action: { title: 'Récupérer l’acte de notoriété auprès du notaire', responsible: 'seller' },
    },
  },
  {
    key: 'attestation_propriete_notariee',
    label: 'Attestation de propriété immobilière',
    description: 'Publiée au service de la publicité foncière, elle constate le transfert aux héritiers.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['succession'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'declaration_succession',
    label: 'Déclaration de succession',
    description: 'Utile au calcul de la plus-value et au contrôle des droits acquittés.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['succession'] },
    produces: { document: { category: 'Fiscalité' } },
  },

  // ---------------------------------------------------------------------
  // Situation — indivision
  // ---------------------------------------------------------------------
  {
    key: 'accord_indivisaires',
    label: 'Accord écrit de tous les indivisaires',
    description: 'La vente d’un bien indivis exige l’unanimité — un seul refus bloque le dossier.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    legalRef: 'Art. 815-3 code civil',
    appliesTo: { requires: ['indivision'] },
    produces: {
      document: { category: 'Propriété' },
      action: { title: 'Recueillir l’accord de tous les indivisaires', responsible: 'advisor' },
    },
  },
  {
    key: 'convention_indivision',
    label: 'Convention d’indivision',
    description: 'Si les indivisaires en ont signé une, elle organise les pouvoirs de chacun.',
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['indivision'] },
    produces: { document: { category: 'Propriété' } },
  },

  // ---------------------------------------------------------------------
  // Situation — divorce
  // ---------------------------------------------------------------------
  {
    key: 'jugement_divorce',
    label: 'Jugement ou convention de divorce',
    description: 'Il établit le sort du bien et qui a qualité pour le vendre.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['divorce'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'etat_liquidatif',
    label: 'État liquidatif du régime matrimonial',
    description: 'Répartition du prix de vente entre les ex-époux, établie par le notaire.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['divorce'] },
    produces: { document: { category: 'Propriété' } },
  },

  // ---------------------------------------------------------------------
  // Situation — societe civile immobiliere
  // ---------------------------------------------------------------------
  {
    key: 'kbis_sci',
    label: 'Extrait K-bis de la SCI',
    description: 'De moins de trois mois, il identifie le gérant en exercice.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    validity: '3 mois',
    appliesTo: { requires: ['sci'] },
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'statuts_sci',
    label: 'Statuts à jour de la SCI',
    description: 'Ils déterminent les pouvoirs du gérant et les majorités requises pour vendre.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['sci'] },
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'pv_ag_sci_vente',
    label: 'PV d’assemblée autorisant la vente',
    description: 'Décision des associés habilitant le gérant à signer, quand les statuts l’exigent.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['sci'] },
    produces: { document: { category: 'Propriété' } },
  },

  // ---------------------------------------------------------------------
  // Situation — bien loue
  // ---------------------------------------------------------------------
  {
    key: 'bail_en_cours',
    label: 'Bail en cours',
    description: 'Contrat de location signé, avec ses avenants éventuels.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['loue'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'etat_des_lieux_entree',
    label: "État des lieux d'entrée",
    description: 'Il conditionne la restitution du dépôt de garantie.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['loue'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'quittances_loyer',
    label: 'Dernières quittances de loyer',
    description: 'Elles prouvent le montant du loyer et la régularité du locataire.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { requires: ['loue'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'conge_vente_ou_renonciation',
    label: 'Congé pour vente ou renonciation au droit de préemption',
    description: 'Le locataire est prioritaire : sa purge conditionne toute vente libre.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    legalRef: 'Art. 15-II loi du 6 juillet 1989',
    appliesTo: { requires: ['loue'] },
    produces: {
      document: { category: 'Propriété' },
      action: { title: 'Purger le droit de préemption du locataire', responsible: 'advisor' },
    },
  },
  {
    key: 'depot_garantie',
    label: 'Justificatif du dépôt de garantie',
    description: 'Il est transféré à l’acquéreur le jour de la vente.',
    severity: 'obligatoire',
    dueStage: SOLD_STAGE,
    appliesTo: { requires: ['loue'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'surface_boutin',
    label: 'Surface habitable (loi Boutin)',
    description: 'Diagnostic de location : la surface figure déjà au bail, à joindre si elle y manque.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['loue'] },
    produces: { document: { category: 'Diagnostics' } },
  },

  // ---------------------------------------------------------------------
  // Situation — viager
  // ---------------------------------------------------------------------
  {
    key: 'acte_naissance_credirentier',
    label: 'Acte de naissance du crédirentier',
    description: 'Il fixe l’âge retenu pour le calcul de la rente.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['viager'] },
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'attestation_occupation',
    label: 'Attestation d’occupation du bien',
    description: 'Elle précise si la vente est en viager occupé ou libre.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { requires: ['viager'] },
    produces: { document: { category: 'Propriété' } },
  },
  {
    key: 'calcul_bouquet_rente',
    label: 'Calcul du bouquet et de la rente',
    description: 'Note de calcul du barème viager, à établir avant toute commercialisation.',
    severity: 'obligatoire',
    dueStage: MARKETING_VISITS_STAGE,
    appliesTo: { requires: ['viager'] },
    produces: {
      document: { category: 'Autre' },
      action: { title: 'Établir le calcul du bouquet et de la rente', responsible: 'advisor' },
    },
  },

  // ---------------------------------------------------------------------
  // Situation — revente d'un bien livre en VEFA
  // ---------------------------------------------------------------------
  {
    key: 'pv_livraison',
    label: 'Procès-verbal de livraison',
    description: 'Livraison du bien par le promoteur, avec les réserves émises.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['vefa'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'pv_levee_reserves',
    label: 'Procès-verbal de levée des réserves',
    description: 'Il atteste que les réserves de livraison ont été traitées.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['vefa'] },
    produces: { document: { category: 'Travaux' } },
  },
  {
    key: 'notice_descriptive',
    label: 'Notice descriptive du programme',
    description: 'Descriptif technique remis par le promoteur à la vente initiale.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['vefa'] },
    produces: { document: { category: 'Travaux' } },
  },

  // ---------------------------------------------------------------------
  // Situation — protection juridique
  // ---------------------------------------------------------------------
  {
    key: 'jugement_protection',
    label: 'Jugement de tutelle, curatelle ou habilitation familiale',
    description: 'Il désigne la personne habilitée à représenter le vendeur.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    appliesTo: { requires: ['protection_juridique'] },
    produces: { document: { category: 'Identité' } },
  },
  {
    key: 'autorisation_juge_vente',
    label: 'Autorisation du juge des contentieux de la protection',
    description: 'La vente du logement d’un majeur protégé exige une autorisation expresse.',
    severity: 'obligatoire',
    dueStage: SIGNED_MANDATE_STAGE,
    legalRef: 'Art. 426 code civil',
    appliesTo: { requires: ['protection_juridique'] },
    produces: {
      document: { category: 'Propriété' },
      action: { title: 'Obtenir l’autorisation du juge', responsible: 'seller' },
    },
  },

  // ---------------------------------------------------------------------
  // Situation — fiscalite
  // ---------------------------------------------------------------------
  {
    key: 'representant_fiscal',
    label: 'Désignation d’un représentant fiscal',
    description: 'Requise pour un vendeur non-résident au-delà des seuils légaux.',
    severity: 'obligatoire',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requires: ['non_resident_fiscal'] },
    produces: {
      document: { category: 'Fiscalité' },
      action: { title: 'Désigner un représentant fiscal', responsible: 'advisor' },
    },
  },
  {
    key: 'justificatifs_plus_value',
    label: 'Justificatifs pour le calcul de la plus-value',
    description: 'Acte d’acquisition, factures de travaux et frais, pour minorer l’imposition.',
    severity: 'recommande',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: { requiresAny: ['non_resident_fiscal', 'residence_secondaire'] },
    produces: { document: { category: 'Fiscalité' } },
  },

  // ---------------------------------------------------------------------
  // Deprecie — reconnu, jamais repropose
  // ---------------------------------------------------------------------
  {
    key: 'diagnostics',
    label: 'Diagnostics réglementaires',
    description: 'Ancienne entrée groupée, remplacée par le détail diagnostic par diagnostic.',
    severity: 'selon_cas',
    dueStage: PROMISE_SIGNED_STAGE,
    appliesTo: {},
    produces: { action: { title: 'Diagnostics réglementaires', responsible: 'seller' } },
    deprecated: true,
  },
]

// -------------------------------------------------------------------------
// Moteur
// -------------------------------------------------------------------------

export type ResolvedRequirement = {
  requirement: DocumentRequirement
  /**
   * Les drapeaux qui ont declenche la regle, pour afficher « proposé parce
   * que : copropriété ». Vide pour le socle inconditionnel.
   */
  reasons: SaleFlag[]
}

const CATEGORY_RANK = new Map<string, number>(
  DOCUMENT_CATEGORY_OPTIONS.map((category, index) => [category, index])
)

/** Ordre de lecture : ce qui bloque le plus tot se lit en premier. */
const DUE_STAGE_RANK = new Map<string, number>([
  [SIGNED_MANDATE_STAGE, 0],
  [MARKETING_VISITS_STAGE, 1],
  [PROMISE_SIGNED_STAGE, 2],
  [SOLD_STAGE, 3],
])

/**
 * Les axes se combinent en ET ; a l'interieur d'un axe, `propertyTypes` et
 * `requiresAny` sont des OU, `requires` un ET, `excludes` un NI.
 */
export function matchesCondition(
  condition: RequirementCondition,
  propertyType: PropertyTypeKey | null,
  flags: ReadonlySet<SaleFlag>
): boolean {
  if (condition.propertyTypes && condition.propertyTypes.length > 0) {
    // Un type de bien non renseigne ne peut pas satisfaire une regle qui en
    // exige un : mieux vaut ne pas proposer que proposer a tort.
    if (!propertyType || !condition.propertyTypes.includes(propertyType)) return false
  }

  if (condition.excludePropertyTypes && propertyType) {
    if (condition.excludePropertyTypes.includes(propertyType)) return false
  }

  if (condition.requires && !condition.requires.every((flag) => flags.has(flag))) return false

  if (condition.requiresAny && condition.requiresAny.length > 0) {
    if (!condition.requiresAny.some((flag) => flags.has(flag))) return false
  }

  if (condition.excludes && condition.excludes.some((flag) => flags.has(flag))) return false

  return true
}

/** Les drapeaux cites par la condition et effectivement presents. */
function collectReasons(condition: RequirementCondition, flags: ReadonlySet<SaleFlag>): SaleFlag[] {
  const cited = [...(condition.requires ?? []), ...(condition.requiresAny ?? [])]
  return cited.filter((flag) => flags.has(flag))
}

/**
 * Liste des pieces et actions appelees par ce contexte, triee.
 *
 * Le tri est stable — categorie, puis echeance, puis ordre de declaration —
 * parce qu'une liste de trente-quatre lignes qui danse d'un affichage a l'autre
 * est illisible.
 */
export function resolveDocumentRequirements(context: SaleContext): ResolvedRequirement[] {
  const flags = new Set(deriveSaleFlags(context))
  const declarationRank = new Map(DOCUMENT_REQUIREMENTS.map((entry, index) => [entry.key, index]))

  return DOCUMENT_REQUIREMENTS.filter((requirement) => !requirement.deprecated)
    .filter((requirement) => matchesCondition(requirement.appliesTo, context.property_type, flags))
    .map((requirement) => ({ requirement, reasons: collectReasons(requirement.appliesTo, flags) }))
    .sort((left, right) => {
      const leftCategory = left.requirement.produces.document?.category
      const rightCategory = right.requirement.produces.document?.category
      // Les regles sans volet piece (shooting, visuels) se rangent en fin de
      // liste : elles ne sont pas des pieces a reunir.
      const leftRank = leftCategory ? CATEGORY_RANK.get(leftCategory) ?? 99 : 99
      const rightRank = rightCategory ? CATEGORY_RANK.get(rightCategory) ?? 99 : 99
      if (leftRank !== rightRank) return leftRank - rightRank

      const leftDue = DUE_STAGE_RANK.get(left.requirement.dueStage) ?? 99
      const rightDue = DUE_STAGE_RANK.get(right.requirement.dueStage) ?? 99
      if (leftDue !== rightDue) return leftDue - rightDue

      return (declarationRank.get(left.requirement.key) ?? 0) - (declarationRank.get(right.requirement.key) ?? 0)
    })
}

/** Les regles qui produisent une piece — ce que la route `POST` va creer. */
export function documentRequirementsFor(context: SaleContext): ResolvedRequirement[] {
  return resolveDocumentRequirements(context).filter((entry) => entry.requirement.produces.document)
}

export function findRequirement(key: string): DocumentRequirement | undefined {
  return DOCUMENT_REQUIREMENTS.find((entry) => entry.key === key)
}

// -------------------------------------------------------------------------
// Reconciliation avec ce que porte deja le dossier
// -------------------------------------------------------------------------

export type RequirementState = 'present' | 'missing' | 'orphan'

export type DocumentRow = {
  id: string
  label: string
  requirement_key: string | null
  status: string
}

export type ReconciledRequirement = {
  key: string
  label: string
  description: string
  severity: RequirementSeverity
  dueStage: SellerStage
  category: RequirementCategory
  legalRef?: string
  validity?: string
  reasons: SaleFlag[]
  state: RequirementState
  /** La ligne `client_documents` correspondante, si elle existe. */
  document: DocumentRow | null
}

/**
 * Confronte les pieces attendues et les pieces presentes.
 *
 * La comparaison se fait par CLE, jamais par libelle : le conseiller peut
 * renommer « DPE » en « DPE (commandé le 12/09) », la piece doit rester
 * reconnue. C'est aussi la seule facon de reperer les orphelines.
 */
export function reconcileRequirements(input: {
  context: SaleContext
  documents: DocumentRow[]
}): ReconciledRequirement[] {
  const resolved = documentRequirementsFor(input.context)
  const byKey = new Map<string, DocumentRow>()
  for (const document of input.documents) {
    if (document.requirement_key) byKey.set(document.requirement_key, document)
  }

  const rows: ReconciledRequirement[] = resolved.map(({ requirement, reasons }) => {
    const document = byKey.get(requirement.key) ?? null
    return {
      key: requirement.key,
      label: requirement.label,
      description: requirement.description,
      severity: requirement.severity,
      dueStage: requirement.dueStage,
      // `documentRequirementsFor` a deja filtre sur la presence du volet piece.
      category: requirement.produces.document!.category,
      legalRef: requirement.legalRef,
      validity: requirement.validity,
      reasons,
      state: document ? 'present' : 'missing',
      document,
    }
  })

  // Orphelines : une piece porte une cle qui ne s'applique plus au contexte
  // courant. Jamais supprimee automatiquement — le vendeur a peut-etre deja
  // depose le fichier.
  const expected = new Set(resolved.map((entry) => entry.requirement.key))
  for (const document of input.documents) {
    if (!document.requirement_key || expected.has(document.requirement_key)) continue
    const requirement = findRequirement(document.requirement_key)
    // Une cle inconnue du referentiel (regle supprimee d'une ancienne version)
    // n'est pas signalee : on ne sait rien d'elle, mieux vaut se taire.
    if (!requirement || !requirement.produces.document) continue

    rows.push({
      key: requirement.key,
      label: requirement.label,
      description: requirement.description,
      severity: requirement.severity,
      dueStage: requirement.dueStage,
      category: requirement.produces.document.category,
      legalRef: requirement.legalRef,
      validity: requirement.validity,
      reasons: [],
      state: 'orphan',
      document,
    })
  }

  return rows
}

export type RequirementSummary = {
  expected: number
  present: number
  missing: number
  orphans: number
  /** Pieces obligatoires encore absentes — le seul chiffre qui alarme. */
  blockingMissing: number
}

export function summarizeRequirements(rows: ReconciledRequirement[]): RequirementSummary {
  const expected = rows.filter((row) => row.state !== 'orphan')
  return {
    expected: expected.length,
    present: expected.filter((row) => row.state === 'present').length,
    missing: expected.filter((row) => row.state === 'missing').length,
    orphans: rows.filter((row) => row.state === 'orphan').length,
    blockingMissing: expected.filter((row) => row.state === 'missing' && row.severity === 'obligatoire').length,
  }
}
