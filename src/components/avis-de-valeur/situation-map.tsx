import { haversineKm } from '@/lib/avis-de-valeur/market-analysis'
import type { ComparableProperty, PropertyData } from '@/lib/avis-de-valeur/types'

/**
 * Plan de situation des comparables.
 *
 * SVG pur, sans fond cartographique : un fond de carte suppose un appel réseau
 * au moment de l'impression, et une tuile absente laisse un rectangle gris dans
 * un document remis en main propre. Ici les positions sont relatives au bien,
 * avec une échelle explicite — ce qui est exactement l'information utile.
 */
export function SituationMap({
  property,
  comparables,
  width = 250,
  height = 180,
}: {
  property: PropertyData
  comparables: ComparableProperty[]
  width?: number
  height?: number
}) {
  const origin =
    property.lat !== null && property.lon !== null ? { lat: property.lat, lon: property.lon } : null

  const points = comparables.filter(
    (comparable): comparable is ComparableProperty & { lat: number; lon: number } =>
      comparable.lat !== null && comparable.lon !== null,
  )

  if (!origin || points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-[#CDF7FF] bg-[#E9FCFF]/40 text-center text-[9.5px] leading-snug text-slate-500"
        style={{ width, height }}
      >
        Coordonnées du bien ou des comparables
        <br />
        non disponibles
      </div>
    )
  }

  // Projection locale : à cette échelle, une correction en cosinus de latitude suffit.
  const latScale = 1
  const lonScale = Math.cos((origin.lat * Math.PI) / 180)

  const coords = [
    { x: 0, y: 0, isOrigin: true, label: '' },
    ...points.map((point, index) => ({
      x: (point.lon - origin.lon) * lonScale,
      y: -(point.lat - origin.lat) * latScale,
      isOrigin: false,
      label: String(index + 1),
    })),
  ]

  const maxExtent = Math.max(...coords.map((coord) => Math.max(Math.abs(coord.x), Math.abs(coord.y))), 1e-4)
  const padding = 18
  const usable = Math.min(width, height) / 2 - padding
  const project = (coord: { x: number; y: number }) => ({
    cx: width / 2 + (coord.x / maxExtent) * usable,
    cy: height / 2 + (coord.y / maxExtent) * usable,
  })

  // Rayon du cercle de repère : distance du comparable le plus éloigné, arrondie.
  const farthestKm = Math.max(
    ...points.map((point) => haversineKm(origin, { lat: point.lat, lon: point.lon })),
  )
  const ringRatio = usable / maxExtent
  const ringKmRadius = niceRadius(farthestKm)
  const ringPixels = farthestKm > 0 ? (ringKmRadius / farthestKm) * ringRatio * maxExtent : usable

  return (
    <svg width={width} height={height} className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/40">
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(ringPixels, usable)}
        fill="none"
        stroke="#95EBFF"
        strokeDasharray="3 3"
      />
      <text
        x={width / 2 + Math.min(ringPixels, usable) + 3}
        y={height / 2 - 3}
        fontSize={7}
        fill="#008EC3"
        fontWeight="700"
      >
        {formatKm(ringKmRadius)}
      </text>

      {coords.slice(1).map((coord, index) => {
        const { cx, cy } = project(coord)
        const center = project(coords[0])
        return (
          <g key={index}>
            <line x1={center.cx} y1={center.cy} x2={cx} y2={cy} stroke="#CDF7FF" strokeWidth={1} />
            <circle cx={cx} cy={cy} r={7} fill="#008EC3" />
            <text x={cx} y={cy + 2.5} fontSize={7.5} fill="#ffffff" fontWeight="700" textAnchor="middle">
              {coord.label}
            </text>
          </g>
        )
      })}

      {(() => {
        const { cx, cy } = project(coords[0])
        return (
          <g>
            <circle cx={cx} cy={cy} r={9} fill="#00b4ec" stroke="#ffffff" strokeWidth={2} />
            <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
          </g>
        )
      })()}
    </svg>
  )
}

function niceRadius(km: number): number {
  if (km <= 0) return 0.5
  const steps = [0.25, 0.5, 1, 2, 3, 5, 10, 20]
  return steps.find((step) => step >= km) ?? Math.ceil(km)
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${new Intl.NumberFormat('fr-FR').format(km)} km`
}
