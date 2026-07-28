/**
 * Géocodage de l'adresse du bien via la Base Adresse Nationale.
 *
 * Utilisé uniquement en secours, quand `seller_properties` ne porte pas de
 * coordonnées : sans point d'origine, le plan de situation des comparables ne
 * peut pas être tracé, alors que la DVF, elle, est géolocalisée.
 *
 * Échoue en silence : un rapport sans plan reste un rapport valide, un rapport
 * qui ne s'affiche pas parce qu'une API publique répond mal, non.
 */
export async function geocodeAddress(
  address: string,
  city: string | null,
  postalCode: string | null,
): Promise<{ lat: number; lon: number } | null> {
  const query = [address, postalCode, city].filter(Boolean).join(' ').trim()
  if (!query) return null

  try {
    const url = new URL('https://api-adresse.data.gouv.fr/search/')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')
    if (postalCode) url.searchParams.set('postcode', postalCode)

    const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null

    const payload = (await response.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { score?: number } }>
    }

    const feature = payload.features?.[0]
    const coordinates = feature?.geometry?.coordinates
    // Sous 0,4 de score, la BAN renvoie souvent le centre de la commune : un
    // point faux placé au milieu du village vaut moins qu'aucun point.
    if (!coordinates || (feature?.properties?.score ?? 0) < 0.4) return null

    const [lon, lat] = coordinates
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
  } catch {
    return null
  }
}
