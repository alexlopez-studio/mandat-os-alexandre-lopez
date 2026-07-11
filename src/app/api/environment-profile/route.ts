import { NextRequest, NextResponse } from 'next/server'

type EnvironmentKind =
  | 'road_axis'
  | 'urban_dense'
  | 'village_residential'
  | 'natural_residential'
  | 'neutral'

type EnvironmentItem = {
  label: string
  text: string
}

type EnvironmentProfile = {
  kind: EnvironmentKind
  confidence: 'faible' | 'moyenne' | 'élevée'
  title: string
  subtitle: string
  highlight: string
  items: EnvironmentItem[]
  footer: string
}

type OverpassElement = {
  tags?: Record<string, string>
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

const DEFAULT_PROFILE: EnvironmentProfile = {
  kind: 'neutral',
  confidence: 'faible',
  title: 'Environnement à vérifier',
  subtitle: 'Cadre, accès et nuisances à confirmer',
  highlight: 'Analyse environnementale indicative : accès, services, bruit et cadre à confirmer avec l’avis terrain',
  items: [
    { label: 'Cadre', text: 'À confirmer selon le secteur exact' },
    { label: 'Nuisances', text: 'Routes, bruit et voisinage à vérifier' },
    { label: 'Secteur', text: 'Contexte local à confirmer' },
    { label: 'Accès', text: 'Accès, stationnement et axes routiers à vérifier' },
  ],
  footer: 'Profil environnement indicatif — accès, services et nuisances à confirmer avec l’avis terrain',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  const address = searchParams.get('address') ?? ''

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(DEFAULT_PROFILE)
  }

  const heuristicProfile = profileFromAddress(address)

  try {
    const overpassProfile = await profileFromOverpass(lat, lng)
    const profile = chooseProfile(overpassProfile, heuristicProfile)
    return NextResponse.json(profile)
  } catch (error) {
    console.error('[api/environment-profile]', error)
    return NextResponse.json(heuristicProfile ?? DEFAULT_PROFILE)
  }
}

function profileFromAddress(address: string): EnvironmentProfile | null {
  const normalized = address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(a7|a8|a50|a51|a52|a55|autoroute|rocade|peripherique)\b/.test(normalized)) {
    return roadAxisProfile('Adresse proche d’un axe routier déclaré')
  }

  if (/\b(marseille|130\d{2}|aix-en-provence|toulon|nice|paris|lyon)\b/.test(normalized)) {
    return urbanProfile('Adresse en secteur urbain dense')
  }

  if (/\b(cotignac|barjols|ponteves|brignoles|saint-maximin|aups|salernes|montmeyan|rians|tavernes|vinon-sur-verdon)\b/.test(normalized)) {
    return villageProfile('Commune résidentielle ou villageoise à qualifier')
  }

  return null
}

async function profileFromOverpass(lat: number, lng: number): Promise<EnvironmentProfile | null> {
  const query = `
[out:json][timeout:8];
(
  way(around:450,${lat},${lng})["highway"~"motorway|trunk|primary|secondary"];
  way(around:250,${lat},${lng})["railway"~"rail|tram|subway"];
  node(around:650,${lat},${lng})["amenity"~"school|hospital|restaurant|cafe|bar|supermarket|pharmacy|bank|post_office"];
  way(around:650,${lat},${lng})["amenity"~"school|hospital|restaurant|cafe|bar|supermarket|pharmacy|bank|post_office"];
  way(around:800,${lat},${lng})["landuse"~"commercial|industrial|retail"];
  way(around:900,${lat},${lng})["landuse"="residential"];
  way(around:1000,${lat},${lng})["natural"~"wood|water|scrub|heath"];
  relation(around:1000,${lat},${lng})["natural"~"wood|water|scrub|heath"];
  way(around:1000,${lat},${lng})["landuse"~"forest|farmland|vineyard|orchard"];
  relation(around:1000,${lat},${lng})["landuse"~"forest|farmland|vineyard|orchard"];
);
out tags center qt 120;
`

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
    next: { revalidate: 60 * 60 * 24 * 7 },
  })

  if (!response.ok) return null

  const data = await response.json() as { elements?: OverpassElement[] }
  const elements = data.elements ?? []
  const stats = summarize(elements)

  if (stats.roadAxis >= 2 || stats.rail >= 1) {
    return roadAxisProfile('Axe routier ou ferroviaire détecté à proximité')
  }

  if (stats.amenities >= 8 || stats.commercial >= 2) {
    return urbanProfile('Services et densité urbaine détectés à proximité')
  }

  if (stats.natural >= 3 && stats.roadAxis === 0 && stats.amenities <= 4) {
    return naturalProfile('Cadre naturel détecté à proximité')
  }

  if (stats.residential >= 1 && stats.amenities <= 7 && stats.roadAxis <= 1) {
    return villageProfile('Secteur résidentiel détecté à proximité')
  }

  return DEFAULT_PROFILE
}

function summarize(elements: OverpassElement[]) {
  return elements.reduce(
    function (acc, element) {
      const tags = element.tags ?? {}
      const highway = tags.highway ?? ''
      const railway = tags.railway ?? ''
      const amenity = tags.amenity ?? ''
      const landuse = tags.landuse ?? ''
      const natural = tags.natural ?? ''

      if (/motorway|trunk|primary|secondary/.test(highway)) acc.roadAxis += 1
      if (/rail|tram|subway/.test(railway)) acc.rail += 1
      if (amenity) acc.amenities += 1
      if (/commercial|industrial|retail/.test(landuse)) acc.commercial += 1
      if (landuse === 'residential') acc.residential += 1
      if (/wood|water|scrub|heath|forest|farmland|vineyard|orchard/.test(natural + ' ' + landuse)) acc.natural += 1
      return acc
    },
    { roadAxis: 0, rail: 0, amenities: 0, commercial: 0, residential: 0, natural: 0 },
  )
}

function chooseProfile(overpassProfile: EnvironmentProfile | null, heuristicProfile: EnvironmentProfile | null): EnvironmentProfile {
  if (overpassProfile?.kind === 'road_axis') return overpassProfile
  if (heuristicProfile?.kind === 'road_axis') return heuristicProfile
  if (overpassProfile && overpassProfile.kind !== 'neutral') return overpassProfile
  if (heuristicProfile) return heuristicProfile
  return overpassProfile ?? DEFAULT_PROFILE
}

function roadAxisProfile(reason: string): EnvironmentProfile {
  return {
    kind: 'road_axis',
    confidence: 'moyenne',
    title: 'Environnement à vigilance',
    subtitle: 'Axe routier / nuisances possibles à vérifier',
    highlight: 'Le secteur semble demander une vérification attentive du bruit, des accès et de l’environnement immédiat.',
    items: [
      { label: 'Bruit', text: 'Nuisances routières à vérifier sur place' },
      { label: 'Accès', text: 'Accès véhicule potentiellement favorable' },
      { label: 'Services', text: 'Commodités possibles à proximité' },
      { label: 'Contexte', text: reason },
    ],
    footer: 'Profil environnement indicatif — bruit, accès et voisinage à confirmer avec l’avis terrain',
  }
}

function urbanProfile(reason: string): EnvironmentProfile {
  return {
    kind: 'urban_dense',
    confidence: 'moyenne',
    title: 'Environnement urbain',
    subtitle: 'Services, accès et nuisances à équilibrer',
    highlight: 'Le secteur semble plutôt urbain : la valeur dépendra de l’accès, des services, du bruit et de la qualité de l’adresse exacte.',
    items: [
      { label: 'Services', text: 'Commerces et équipements à vérifier' },
      { label: 'Accès', text: 'Mobilité et stationnement à analyser' },
      { label: 'Nuisances', text: 'Bruit et trafic à confirmer sur place' },
      { label: 'Contexte', text: reason },
    ],
    footer: 'Profil environnement indicatif — attractivité urbaine et nuisances à confirmer avec l’avis terrain',
  }
}

function villageProfile(reason: string): EnvironmentProfile {
  return {
    kind: 'village_residential',
    confidence: 'moyenne',
    title: 'Environnement résidentiel',
    subtitle: 'Cadre villageois ou résidentiel à confirmer',
    highlight: 'Le secteur semble résidentiel : la valeur dépendra du calme réel, de l’accès, du stationnement et de la proximité des services.',
    items: [
      { label: 'Cadre', text: 'Ambiance résidentielle à confirmer' },
      { label: 'Services', text: 'Commerces et écoles à situer précisément' },
      { label: 'Accès', text: 'Accès et stationnement à vérifier' },
      { label: 'Contexte', text: reason },
    ],
    footer: 'Profil environnement indicatif — cadre, accès et services à confirmer avec l’avis terrain',
  }
}

function naturalProfile(reason: string): EnvironmentProfile {
  return {
    kind: 'natural_residential',
    confidence: 'moyenne',
    title: 'Environnement naturel',
    subtitle: 'Cadre naturel avec accès à vérifier',
    highlight: 'Le secteur semble bénéficier d’un cadre plus naturel. L’accès, l’isolement, les services et les éventuelles contraintes doivent être confirmés.',
    items: [
      { label: 'Cadre', text: 'Présence d’éléments naturels détectée' },
      { label: 'Accès', text: 'Temps d’accès et voirie à vérifier' },
      { label: 'Services', text: 'Éloignement possible des commodités' },
      { label: 'Contexte', text: reason },
    ],
    footer: 'Profil environnement indicatif — cadre naturel, accès et contraintes à confirmer avec l’avis terrain',
  }
}
