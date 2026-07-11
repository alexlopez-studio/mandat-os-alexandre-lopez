import { z } from 'zod'

/**
 * Schéma de validation pour POST /api/estimation
 *
 * Bornes France métropolitaine (incluant Corse) :
 *   - lat ∈ [41, 51.5]
 *   - lng ∈ [-5.5, 10]
 *
 * Les enums (etat, dpe, delai) sont alignés sur les coefficients
 * actuels dans `src/lib/estimation.ts` (source de vérité du moteur).
 */
export const estimationInputSchema = z.object({
  lat: z
    .number({ invalid_type_error: 'lat doit être un nombre' })
    .min(41, 'Latitude hors France métropolitaine')
    .max(51.5, 'Latitude hors France métropolitaine'),
  lng: z
    .number({ invalid_type_error: 'lng doit être un nombre' })
    .min(-5.5, 'Longitude hors France métropolitaine')
    .max(10, 'Longitude hors France métropolitaine'),
  surface: z
    .number({ invalid_type_error: 'surface doit être un nombre' })
    .positive('La surface doit être strictement positive')
    .max(10000, 'Surface trop grande (max 10 000 m²)'),
  type_bien: z
    .enum(['appartement', 'maison', 'terrain', 'autre'])
    .optional(),
  sous_type: z
    .string({ invalid_type_error: 'sous_type doit être une chaîne' })
    .max(80, 'sous_type trop long')
    .optional(),
  etat: z
    .enum(['neuf', 'tres_bon_etat', 'bon_etat', 'rafraichir', 'travaux'])
    .optional(),
  dpe: z
    .enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'NC'])
    .optional(),
  equipements: z
    .array(z.string().max(50))
    .max(30, 'Trop d’équipements (max 30)')
    .optional(),
  delai: z
    .enum(['immediat', '1_3_mois', '3_6_mois', '6_mois'])
    .optional(),
  surface_terrain: z
    .number({ invalid_type_error: 'surface_terrain doit être un nombre' })
    .positive('La surface terrain doit être strictement positive')
    .max(100000, 'Surface terrain trop grande')
    .nullable()
    .optional(),
  cadastre_surface: z
    .number({ invalid_type_error: 'cadastre_surface doit être un nombre' })
    .positive('La surface cadastrale doit être strictement positive')
    .max(100000, 'Surface cadastrale trop grande')
    .nullable()
    .optional(),
  annee_construction: z
    .number({ invalid_type_error: 'annee_construction doit être un nombre' })
    .int('annee_construction doit être une année entière')
    .min(1600, 'Année de construction trop ancienne')
    .max(new Date().getFullYear() + 2, 'Année de construction invalide')
    .optional(),
  dpe_verifie: z
    .boolean({ invalid_type_error: 'dpe_verifie doit être un booléen' })
    .optional(),
  numero_dpe: z
    .string({ invalid_type_error: 'numero_dpe doit être une chaîne' })
    .max(50, 'numero_dpe trop long')
    .optional(),
})

export type EstimationInputDto = z.infer<typeof estimationInputSchema>
