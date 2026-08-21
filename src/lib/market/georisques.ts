/**
 * Risques de la parcelle, via les API publiques de l'Etat.
 *
 * Deux appels enchaines, tous deux gratuits et sans jeton :
 *   1. Base Adresse Nationale — adresse libre -> code INSEE + coordonnees ;
 *   2. Georisques v1 — coordonnees -> risques naturels et technologiques.
 *
 * A quoi ca sert : l'ERP (etat des risques) est une piece du dossier, et c'est
 * le vendeur qui la remplit lui-meme — aucun diagnostiqueur n'est requis. Voir
 * de quoi elle sera faite avant de la commander evite les allers-retours.
 *
 * Ce que ca ne fait PAS : cocher les cases du contexte de vente. Georisques ne
 * connait ni les termites, ni la merule, ni le bruit aerien — ces zones-la sont
 * fixees par arretes prefectoraux disperses, sans API nationale. Le seul
 * recoupement possible est le retrait-gonflement des argiles, laisse a
 * l'appreciation du conseiller plutot qu'applique d'office.
 */

const BAN_ENDPOINT = 'https://api-adresse.data.gouv.fr/search'
const GEORISQUES_ENDPOINT = 'https://georisques.gouv.fr/api/v1/resultats_rapport_risque'

/** Un jour : les zonages de risque bougent au rythme des arretes, pas des heures. */
const CACHE_SECONDS = 60 * 60 * 24

/**
 * En deca, le geocodeur a devine plus qu'il n'a trouve.
 *
 * Mesure a l'usage : « 12 rue des Lices 83670 Barjols » (rue inexistante)
 * renvoie « 12 Rue des Boyers » a 0.604 — un numero precis, mais pas le bon.
 * Le score dit la confiance du rapprochement, jamais sa finesse.
 */
const RELIABLE_SCORE = 0.7

/**
 * Granularite du resultat BAN, seul indicateur fiable de precision.
 *
 * Le score ne la donne PAS : « Barjols » seul sort a 0.940 en `municipality`,
 * mieux note qu'une adresse complete. Confondre les deux ferait passer un
 * resultat communal pour une localisation a la parcelle.
 */
const ADDRESS_LEVEL_TYPES = new Set(['housenumber', 'street'])

export type RiskFamily = 'naturel' | 'technologique'

export type RiskEntry = {
  key: string
  label: string
  family: RiskFamily
  /** Statut au niveau de la commune, toujours renseigne. */
  communeStatus: string | null
  /** Statut a l'adresse, plus fin — absent si le geocodage a echoue. */
  addressStatus: string | null
}

export type GeorisquesReport = {
  commune: { label: string; codeInsee: string; codePostal: string | null }
  /** Adresse telle que la BAN l'a comprise, pour que le conseiller verifie. */
  matchedAddress: string | null
  /** `adresse` = precision parcellaire ; `commune` = repli ; `incertain` = geocodage douteux. */
  precision: 'adresse' | 'commune' | 'incertain'
  risks: RiskEntry[]
  /** Lien vers le rapport complet, a remettre au vendeur. */
  reportUrl: string | null
}

type RawRisk = {
  present?: boolean
  libelle?: string
  libelleStatutCommune?: string | null
  libelleStatutAdresse?: string | null
}

/**
 * Normalise la reponse Georisques. Fonction pure : c'est elle qui est testee,
 * pas le reseau.
 */
export function normalizeGeorisquesReport(
  raw: unknown,
  precision: GeorisquesReport['precision']
): GeorisquesReport | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>

  const commune = asRecord(record.commune)
  const codeInsee = asText(commune.codeInsee)
  if (!codeInsee) return null

  const risks: RiskEntry[] = []
  for (const [family, field] of [
    ['naturel', 'risquesNaturels'],
    ['technologique', 'risquesTechnologiques'],
  ] as const) {
    const group = asRecord(record[field])
    for (const [key, value] of Object.entries(group)) {
      const risk = value as RawRisk
      // On ne garde que les risques presents : lister les absents noierait le
      // signal sous vingt lignes de « non concerne ».
      if (!risk?.present) continue
      risks.push({
        key,
        label: asText(risk.libelle) ?? key,
        family,
        communeStatus: asText(risk.libelleStatutCommune),
        addressStatus: asText(risk.libelleStatutAdresse),
      })
    }
  }

  const address = asRecord(record.adresse)

  return {
    commune: {
      label: asText(commune.libelle) ?? 'Commune inconnue',
      codeInsee,
      codePostal: asText(commune.codePostal),
    },
    matchedAddress: asText(address.libelle),
    precision,
    risks,
    reportUrl: asText(record.url),
  }
}

/** Vrai si Georisques signale un retrait-gonflement des argiles. */
export function hasClayRisk(report: GeorisquesReport): boolean {
  return report.risks.some((risk) => risk.key === 'retraitGonflementArgile')
}

type AddressInput = {
  address?: string | null
  city?: string | null
  zipcode?: string | null
}

type GeocodeResult = {
  codeInsee: string
  longitude: number
  latitude: number
  label: string
  precision: GeorisquesReport['precision']
}

/** Compose une requete BAN a partir des champs de la fiche projet. */
export function buildGeocodeQuery(input: AddressInput): string | null {
  const parts = [input.address, input.zipcode, input.city]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Precision d'un resultat BAN, a partir de sa granularite et de sa confiance.
 *
 * Deux questions distinctes, souvent confondues : a-t-on une adresse ou une
 * commune (le `type`), et le rapprochement est-il sur (le `score`) ? Un
 * resultat `municipality` reste communal meme note 0.94.
 */
export function geocodePrecision(type: string | null, score: unknown): GeorisquesReport['precision'] {
  if (!type || !ADDRESS_LEVEL_TYPES.has(type)) return 'commune'
  const value = typeof score === 'number' ? score : 0
  return value >= RELIABLE_SCORE ? 'adresse' : 'incertain'
}

async function geocode(input: AddressInput): Promise<GeocodeResult | null> {
  const query = buildGeocodeQuery(input)
  if (!query) return null

  const url = `${BAN_ENDPOINT}?q=${encodeURIComponent(query)}&limit=1`
  const res = await fetch(url, { next: { revalidate: CACHE_SECONDS } })
  if (!res.ok) return null

  const json = (await res.json()) as { features?: Array<Record<string, unknown>> }
  const feature = json.features?.[0]
  if (!feature) return null

  const properties = asRecord(feature.properties)
  const geometry = asRecord(feature.geometry)
  const coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : []
  const codeInsee = asText(properties.citycode)
  const [longitude, latitude] = coordinates as [number?, number?]

  if (!codeInsee || typeof longitude !== 'number' || typeof latitude !== 'number') return null

  return {
    codeInsee,
    longitude,
    latitude,
    label: asText(properties.label) ?? query,
    precision: geocodePrecision(asText(properties.type), properties.score),
  }
}

/**
 * Rapport de risques pour un bien.
 *
 * Degrade proprement : coordonnees si le geocodage a reussi (precision
 * parcellaire), code INSEE sinon (precision communale), `null` si les deux
 * echouent. Un service externe indisponible ne doit jamais casser la fiche.
 */
export async function fetchPropertyRisks(input: AddressInput): Promise<GeorisquesReport | null> {
  try {
    const located = await geocode(input)

    if (located) {
      // L'ordre attendu par Georisques est longitude,latitude.
      const url = `${GEORISQUES_ENDPOINT}?latlon=${located.longitude},${located.latitude}`
      const res = await fetch(url, { next: { revalidate: CACHE_SECONDS } })
      if (res.ok) {
        const report = normalizeGeorisquesReport(await res.json(), located.precision)
        if (report) {
          return { ...report, matchedAddress: report.matchedAddress ?? located.label }
        }
      }
    }

    // Repli commune : mieux vaut un rapport communal qu'aucun rapport.
    const codeInsee = located?.codeInsee
    if (!codeInsee) return null

    const res = await fetch(`${GEORISQUES_ENDPOINT}?code_insee=${codeInsee}`, {
      next: { revalidate: CACHE_SECONDS },
    })
    if (!res.ok) return null

    return normalizeGeorisquesReport(await res.json(), 'commune')
  } catch (err) {
    console.error('[georisques] fetchPropertyRisks:', err)
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
