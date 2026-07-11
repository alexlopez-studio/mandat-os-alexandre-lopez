'use client'

import { useEffect, useState } from 'react'
import { PropertiesMap } from './PropertiesMap'

type PropertyApiRow = {
  id: string
  title: string | null
  city: string | null
  price: number | null
  surface: number | null
  rooms: number | null
  property_type: string | null
  lat: number | null
  lon: number | null
  status: string | null
}

type MapProperty = {
  id: string
  title: string
  city: string
  price: number
  surface: number
  rooms: number
  propertyType: string
  lat: number
  lng: number
  status: string
}

function normalizeStatus(status: string | null): string {
  if (!status) return 'actif'
  if (status === 'active') return 'actif'
  if (status === 'price_drop') return 'prix_en_baisse'
  if (status === 'new') return 'nouveau'
  if (status === 'opportunity') return 'opportunite'
  if (status === 'stagnant') return 'stagne'
  if (status === 'expired') return 'expire'
  if (status === 'removed') return 'retire'
  return status
}

export function PropertiesMapWrapper({ initialZipcode }: { initialZipcode?: string }) {
  const [properties, setProperties] = useState<MapProperty[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadMapProperties() {
      const params = new URLSearchParams({
        limit: '100',
        sort: 'last_seen_at.desc',
      })
      if (initialZipcode) params.set('zipcode', initialZipcode)

      const res = await fetch(`/api/market/properties?${params}`)
      const data = await res.json()
      const rows = (data.properties ?? []) as PropertyApiRow[]

      const mapped = rows
        .filter((row) => typeof row.lat === 'number' && typeof row.lon === 'number')
        .map((row) => ({
          id: row.id,
          title: row.title ?? 'Bien sans titre',
          city: row.city ?? '—',
          price: row.price ?? 0,
          surface: row.surface ?? 0,
          rooms: row.rooms ?? 0,
          propertyType: row.property_type ?? 'Bien',
          lat: row.lat as number,
          lng: row.lon as number,
          status: normalizeStatus(row.status),
        }))

      if (!cancelled) setProperties(mapped)
    }

    loadMapProperties().catch((err) => {
      console.error('Erreur chargement carte biens', err)
      if (!cancelled) setProperties([])
    })

    return () => {
      cancelled = true
    }
  }, [initialZipcode])

  return <PropertiesMap properties={properties} />
}
