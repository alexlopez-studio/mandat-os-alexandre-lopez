/**
 * Drapeaux derives du contexte de vente.
 *
 * Toute l'arithmetique metier — seuils d'annees, « plus de 15 ans », prudence
 * sur les valeurs inconnues — est enfermee ici, dans une seule fonction pure et
 * testee. Les regles du referentiel ne manipulent ensuite QUE des chaines.
 *
 * Ce n'est pas une coquetterie : c'est ce qui rend une regle integralement
 * serialisable en JSON, donc migrable en base sans reecrire le moteur.
 */

import type { SaleContext } from './sale-context'

export const SALE_FLAGS = [
  // Regime
  'copropriete',
  'monopropriete',
  // Age du bati (date du PERMIS, pas de l'achevement)
  'permis_avant_1949',
  'permis_avant_1997',
  // Reseaux
  'elec_a_diagnostiquer',
  'gaz_a_diagnostiquer',
  'assainissement_collectif',
  'assainissement_non_collectif',
  // Energie
  'dpe_passoire',
  // Equipements
  'piscine',
  'veranda',
  'cheminee',
  'panneaux_solaires',
  // Zones
  'zone_termites',
  'zone_merule',
  'zone_bruit_aerien',
  'zone_argile',
  'lotissement',
  // Travaux
  'travaux_recents',
  // Situations de vente
  'succession',
  'indivision',
  'divorce',
  'sci',
  'vefa',
  'viager',
  'loue',
  'protection_juridique',
  'non_resident_fiscal',
  'residence_secondaire',
] as const

export type SaleFlag = (typeof SALE_FLAGS)[number]

const SALE_FLAG_SET: ReadonlySet<string> = new Set(SALE_FLAGS)

export function isSaleFlag(value: unknown): value is SaleFlag {
  return typeof value === 'string' && SALE_FLAG_SET.has(value)
}

/**
 * Projette les faits bruts vers les conditions que lisent les regles.
 *
 * Deux partis pris, tous deux prudents :
 *
 *   - un permis anterieur a 1949 leve AUSSI `permis_avant_1997` — les seuils
 *     sont emboites, un bien de 1930 appelle le plomb et l'amiante ;
 *   - une periode `inconnu` leve les DEUX seuils. Un diagnostic inutile coute
 *     cent cinquante euros, un diagnostic manquant fait sauter un compromis.
 */
export function deriveSaleFlags(context: SaleContext): SaleFlag[] {
  const flags = new Set<SaleFlag>()

  if (context.regime === 'copropriete') flags.add('copropriete')
  if (context.regime === 'monopropriete') flags.add('monopropriete')

  // Seuils emboites + prudence sur l'inconnu.
  if (context.permis_periode === 'avant_1949' || context.permis_periode === 'inconnu') {
    flags.add('permis_avant_1949')
  }
  if (
    context.permis_periode === 'avant_1949' ||
    context.permis_periode === 'de_1949_a_1997' ||
    context.permis_periode === 'inconnu'
  ) {
    flags.add('permis_avant_1997')
  }

  if (context.electricite === 'plus_15_ans_ou_inconnu') flags.add('elec_a_diagnostiquer')
  // Gaz absent : aucun diagnostic ne se justifie, aucune prudence a avoir.
  if (context.gaz === 'plus_15_ans_ou_inconnu') flags.add('gaz_a_diagnostiquer')

  if (context.assainissement === 'collectif') flags.add('assainissement_collectif')
  if (context.assainissement === 'non_collectif') flags.add('assainissement_non_collectif')

  // Audit energetique : F et G depuis avril 2023, E depuis janvier 2025.
  // `vierge` et `inconnu` ne declenchent rien — c'est le DPE lui-meme qui
  // tranchera, et il est deja dans le socle du bati.
  if (context.dpe_classe === 'E' || context.dpe_classe === 'F' || context.dpe_classe === 'G') {
    flags.add('dpe_passoire')
  }

  if (context.travaux_recents) flags.add('travaux_recents')

  for (const equipement of context.equipements) flags.add(equipement)
  for (const zone of context.zones) {
    // `lotissement` n'est pas un risque mais un regime parcellaire : il porte
    // son propre nom, les autres prennent le prefixe `zone_`.
    flags.add(zone === 'lotissement' ? 'lotissement' : (`zone_${zone}` as SaleFlag))
  }
  for (const situation of context.situations) flags.add(situation)

  // Ordre de declaration : une liste stable se relit et se teste.
  return SALE_FLAGS.filter((flag) => flags.has(flag))
}
