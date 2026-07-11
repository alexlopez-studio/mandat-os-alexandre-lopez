'use client'

import { useEffect, useMemo, useRef } from 'react'

type Coordinates = {
  lat: number
  lng: number
}

type ComparableMapItem = {
  id: string
  title: string
  location: string | null
  distance: string
  surface: number | null
  rooms: number | null
  price: number | null
  pricePerSqm: number | null
  lat: number | null
  lng: number | null
}

type ComparableLeafletMapProps = {
  comparables: ComparableMapItem[]
  activeComparable: string | null
  setActiveComparable: (id: string | null) => void
  center: Coordinates | null
  city: string
}

const DEFAULT_SECTOR_CENTER: Coordinates = { lat: 43.4521, lng: 5.8623 }

export function ComparableLeafletMap({
  comparables,
  activeComparable,
  setActiveComparable,
  center,
  city,
}: ComparableLeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerLayerRef = useRef<any>(null)
  const clickHandlerRef = useRef<((event: Event) => void) | null>(null)

  const displayPoints = useMemo(
    () => buildDisplayPoints(comparables, center),
    [comparables, center],
  )
  const mapCenter = center ?? averageCoordinates(displayPoints.map((point) => point.position)) ?? DEFAULT_SECTOR_CENTER

  useEffect(() => {
    let cancelled = false
    let invalidateTimer: number | null = null

    async function initMap() {
      const L = await import('leaflet')

      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        link.crossOrigin = ''
        document.head.appendChild(link)
      }

      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([mapCenter.lat, mapCenter.lng], 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      markerLayerRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map

      invalidateTimer = window.setTimeout(() => {
        if (!cancelled && mapInstanceRef.current === map) map.invalidateSize()
      }, 80)
    }

    initMap()

    return () => {
      cancelled = true
      if (invalidateTimer !== null) window.clearTimeout(invalidateTimer)
      if (clickHandlerRef.current) {
        document.removeEventListener('click', clickHandlerRef.current)
        clickHandlerRef.current = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerLayerRef.current = null
      }
    }
  }, [mapCenter.lat, mapCenter.lng])

  useEffect(() => {
    let cancelled = false

    async function updateMarkers() {
      const L = await import('leaflet')
      const map = mapInstanceRef.current
      const layer = markerLayerRef.current
      if (!map || !layer || cancelled) return

      layer.clearLayers()

      const markers: any[] = []

      if (center) {
        const propertyMarker = L.marker([center.lat, center.lng], {
          icon: L.divIcon({
            className: 'portal-leaflet-marker',
            html: `
              <div class="portal-property-marker">
                <span class="portal-property-pulse"></span>
                <span class="portal-property-dot">♥</span>
              </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          }),
          keyboard: true,
        }).bindPopup(`
          <div class="portal-map-popup">
            <p class="portal-map-popup-label">Votre bien</p>
            <p class="portal-map-popup-title">${escapeHtml(city)}</p>
          </div>
        `)

        markers.push(propertyMarker)
        propertyMarker.addTo(layer)
      }

      displayPoints.forEach((point, index) => {
        const isActive = activeComparable === point.comparable.id
        const marker = L.marker([point.position.lat, point.position.lng], {
          icon: L.divIcon({
            className: 'portal-leaflet-marker',
            html: `
              <button type="button" class="portal-comparable-marker ${isActive ? 'is-active' : ''}" data-comparable-id="${escapeHtml(point.comparable.id)}" aria-label="Voir le comparable ${index + 1}">
                ${index + 1}
              </button>
            `,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          }),
          keyboard: true,
        }).bindPopup(buildPopupHtml(point.comparable, index))

        marker.on('click', () => setActiveComparable(isActive ? null : point.comparable.id))
        if (isActive) marker.openPopup()
        markers.push(marker)
        marker.addTo(layer)
      })

      if (markers.length > 1) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds().pad(0.2), { animate: false, maxZoom: 15 })
      } else {
        map.setView([mapCenter.lat, mapCenter.lng], 13, { animate: false })
      }

      map.invalidateSize()
    }

    updateMarkers()

    return () => {
      cancelled = true
    }
  }, [activeComparable, center, city, displayPoints, mapCenter.lat, mapCenter.lng, setActiveComparable])

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border border-border bg-background shadow-inner">
      <div ref={mapRef} className="h-full w-full" aria-label="Carte des biens comparables vendus" />
      <div className="pointer-events-none absolute left-4 top-4 z-[450] rounded-full border border-white/80 bg-white/95 px-3 py-1.5 shadow-sm">
        <span className="portal-label text-muted-foreground">Positions indicatives</span>
      </div>
      <style jsx global>{`
        .portal-leaflet-marker {
          background: transparent;
          border: 0;
        }

        .portal-property-marker {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .portal-property-pulse {
          position: absolute;
          inset: 3px;
          border-radius: 999px;
          background: rgba(0, 119, 182, 0.24);
          animation: portal-map-pulse 1.8s ease-out infinite;
        }

        .portal-property-dot {
          position: absolute;
          inset: 8px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #0077b6;
          color: #ffffff;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.22);
          font-size: 18px;
          line-height: 1;
          border: 4px solid rgba(255, 255, 255, 0.92);
        }

        .portal-comparable-marker {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 4px solid #00A0E2;
          background: #ffffff;
          color: #00A0E2;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 16px;
          font-weight: 800;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
          cursor: pointer;
          transition: transform 160ms ease, background-color 160ms ease, color 160ms ease;
        }

        .portal-comparable-marker:hover,
        .portal-comparable-marker.is-active {
          transform: scale(1.08);
          background: #00A0E2;
          color: #ffffff;
          border-color: #ffffff;
          box-shadow: 0 0 0 6px rgba(0, 160, 226, 0.18), 0 16px 30px rgba(15, 23, 42, 0.24);
        }

        .portal-map-popup {
          min-width: 180px;
          font-family: system-ui, -apple-system, sans-serif;
          color: #0f172a;
        }

        .portal-map-popup-label {
          margin: 0 0 4px;
          color: #00A0E2;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .portal-map-popup-title {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.25;
        }

        .portal-map-popup-meta {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
        }

        .portal-map-popup-price {
          margin: 6px 0 0;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
        }

        @keyframes portal-map-pulse {
          0% {
            transform: scale(0.85);
            opacity: 0.72;
          }
          100% {
            transform: scale(1.45);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

function buildDisplayPoints(comparables: ComparableMapItem[], center: Coordinates | null) {
  const fallbackCenter = center ?? averageCoordinates(comparables.map((item) => validCoordinates(item.lat, item.lng)).filter(Boolean) as Coordinates[]) ?? DEFAULT_SECTOR_CENTER

  return comparables.map((comparable, index) => {
    const coordinates = validCoordinates(comparable.lat, comparable.lng)
    const position = coordinates
      ? offsetCoordinates(coordinates, comparable.id, index)
      : generatedCoordinates(fallbackCenter, index)

    return { comparable, position }
  })
}

function validCoordinates(lat: number | null, lng: number | null): Coordinates | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function generatedCoordinates(center: Coordinates, index: number): Coordinates {
  const angle = (index * 137.5 + 24) * (Math.PI / 180)
  const radiusMeters = 320 + (index % 4) * 180
  return translateCoordinates(center, radiusMeters, angle)
}

function offsetCoordinates(coordinates: Coordinates, id: string, index: number): Coordinates {
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const angle = ((seed % 360) + index * 37) * (Math.PI / 180)
  const radiusMeters = 95 + (seed % 70)
  return translateCoordinates(coordinates, radiusMeters, angle)
}

function translateCoordinates(center: Coordinates, meters: number, angle: number): Coordinates {
  const latOffset = (Math.cos(angle) * meters) / 111_320
  const lngOffset = (Math.sin(angle) * meters) / (111_320 * Math.cos(center.lat * (Math.PI / 180)))
  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset,
  }
}

function averageCoordinates(values: Coordinates[]) {
  if (values.length === 0) return null
  return {
    lat: values.reduce((sum, item) => sum + item.lat, 0) / values.length,
    lng: values.reduce((sum, item) => sum + item.lng, 0) / values.length,
  }
}

function buildPopupHtml(comparable: ComparableMapItem, index: number) {
  return `
    <div class="portal-map-popup">
      <p class="portal-map-popup-label">Comparable ${index + 1}${comparable.distance ? ` · ${escapeHtml(comparable.distance)}` : ''}</p>
      <p class="portal-map-popup-title">${escapeHtml(comparable.title)}</p>
      <p class="portal-map-popup-meta">${escapeHtml([comparable.location, comparable.surface ? `${formatNumber(comparable.surface)} m²` : null, comparable.rooms ? `${formatNumber(comparable.rooms)} pièces` : null].filter(Boolean).join(' · '))}</p>
      <p class="portal-map-popup-price">${comparable.price ? escapeHtml(formatPrice(comparable.price)) : 'Vendu'}</p>
    </div>
  `
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[char] ?? char
  })
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)
}
