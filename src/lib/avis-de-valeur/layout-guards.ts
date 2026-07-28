/**
 * Garde-fous de mise en page.
 *
 * Un document A4 se casse silencieusement : le contenu déborde et se fait
 * couper, le filet de pied de page dérive d'un millimètre par page, une page
 * finit à moitié vide. Rien de tout cela ne déclenche d'erreur, et tout se voit
 * sur le papier remis au vendeur.
 *
 * Cette logique est volontairement séparée de toute mesure DOM : elle prend des
 * relevés et rend des infractions, ce qui la rend testable sans navigateur.
 */

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const PRINT_MARGIN_MM = 12

/** Relevé d'une page, en millimètres, mesuré côté navigateur. */
export interface PageMeasurement {
  pageNumber: number
  widthMm: number
  heightMm: number
  /** Débordement du contenu sous la limite basse utilisable. Négatif = marge restante. */
  contentOverflowMm: number
  /** Taux de remplissage de la zone utile, en %. */
  fillPercent: number
  /** Distance entre le bas de page et le bas du pied de page. `null` sur la couverture. */
  footerOffsetMm: number | null
  /** Plus petite distance entre l'encre et un bord de page. */
  minInkMarginMm: number
  isCover: boolean
}

export interface LayoutViolation {
  pageNumber: number
  rule: string
  detail: string
  severity: 'error' | 'warning'
}

const TOLERANCE_MM = 0.5
/** En deçà, la page paraît inachevée face à un rapport concurrent. */
const MIN_FILL_PERCENT = 45

export function checkPageLayout(pages: PageMeasurement[]): LayoutViolation[] {
  const violations: LayoutViolation[] = []

  for (const page of pages) {
    if (Math.abs(page.widthMm - A4_WIDTH_MM) > TOLERANCE_MM || Math.abs(page.heightMm - A4_HEIGHT_MM) > TOLERANCE_MM) {
      violations.push({
        pageNumber: page.pageNumber,
        rule: 'Format A4',
        detail: `${page.widthMm.toFixed(1)} × ${page.heightMm.toFixed(1)} mm au lieu de ${A4_WIDTH_MM} × ${A4_HEIGHT_MM}`,
        severity: 'error',
      })
    }

    if (page.contentOverflowMm > TOLERANCE_MM) {
      violations.push({
        pageNumber: page.pageNumber,
        rule: 'Débordement',
        detail: `le contenu dépasse de ${page.contentOverflowMm.toFixed(1)} mm et sera coupé à l'impression`,
        severity: 'error',
      })
    }

    // La couverture est un fond perdu assumé : elle échappe à la règle de marge.
    if (!page.isCover && page.minInkMarginMm < PRINT_MARGIN_MM - TOLERANCE_MM) {
      violations.push({
        pageNumber: page.pageNumber,
        rule: 'Zone d’impression',
        detail: `de l'encre à ${page.minInkMarginMm.toFixed(1)} mm du bord, sous les ${PRINT_MARGIN_MM} mm requis`,
        severity: 'error',
      })
    }

    if (!page.isCover && page.footerOffsetMm === null) {
      violations.push({
        pageNumber: page.pageNumber,
        rule: 'Pied de page',
        detail: 'absent alors que la page n’est pas une couverture',
        severity: 'error',
      })
    }

    if (!page.isCover && page.fillPercent < MIN_FILL_PERCENT) {
      violations.push({
        pageNumber: page.pageNumber,
        rule: 'Page trop vide',
        detail: `${Math.round(page.fillPercent)} % de la zone utile remplie`,
        severity: 'warning',
      })
    }
  }

  violations.push(...checkFooterAlignment(pages))
  violations.push(...checkNumbering(pages))

  return violations
}

/** Le filet de pied de page doit tomber à la même hauteur au millimètre près sur toutes les pages. */
function checkFooterAlignment(pages: PageMeasurement[]): LayoutViolation[] {
  const offsets = pages
    .filter((page) => !page.isCover && page.footerOffsetMm !== null)
    .map((page) => ({ pageNumber: page.pageNumber, offset: page.footerOffsetMm as number }))

  if (offsets.length < 2) return []

  const reference = offsets[0].offset
  return offsets
    .filter((entry) => Math.abs(entry.offset - reference) > TOLERANCE_MM)
    .map((entry) => ({
      pageNumber: entry.pageNumber,
      rule: 'Alignement du pied de page',
      detail: `à ${entry.offset.toFixed(1)} mm du bas, contre ${reference.toFixed(1)} mm sur la page ${offsets[0].pageNumber}`,
      severity: 'error' as const,
    }))
}

/** La numérotation doit être continue, sans trou ni doublon. */
function checkNumbering(pages: PageMeasurement[]): LayoutViolation[] {
  const numbers = pages.map((page) => page.pageNumber)
  const violations: LayoutViolation[] = []

  numbers.forEach((number, index) => {
    if (number !== index + 1) {
      violations.push({
        pageNumber: number,
        rule: 'Numérotation',
        detail: `page ${number} en position ${index + 1}`,
        severity: 'error',
      })
    }
  })

  return violations
}
