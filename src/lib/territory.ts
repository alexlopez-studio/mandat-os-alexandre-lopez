export const TERRITORY_LABEL = 'Provence Verte & Verdon'
export const TERRITORY_LABEL_TEXT = 'Provence Verte et Verdon'

export function alignTerritory(value: string): string {
  return value
    .replace(/Provence Verte & Haut-Var/g, 'Provence Verte & Verdon')
    .replace(/Provence Verte et Haut-Var/g, 'Provence Verte et Verdon')
    .replace(/Haut-Var/g, 'Verdon')
}
