/**
 * Arithmetique de grille mensuelle, partagee par `DeadlineCalendar` et
 * `ContentCalendar`. Extraite pour que les deux calendriers decoupent les
 * semaines exactement de la meme facon (lundi en tete, six semaines pleines).
 */

/** Jours de la semaine, format compact, lundi en tete. */
export const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/** Clé de jour locale `AAAA-MM-JJ`, insensible au fuseau contrairement a `toISOString`. */
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: Date) {
  const result = new Date(date)
  const offset = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - offset)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Premier jour du mois de `date`. */
export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Dernier instant du mois de `date`. */
export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Six semaines de sept jours couvrant `month`, debordements inclus.
 * Six et non cinq : c'est le maximum qu'un mois peut occuper, et une hauteur
 * de grille constante evite que le calendrier saute d'un mois a l'autre.
 */
export function buildWeeks(month: Date): Date[][] {
  const cursor = startOfWeek(month)
  const weeks: Date[][] = []
  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = []
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(days)
  }
  return weeks
}
