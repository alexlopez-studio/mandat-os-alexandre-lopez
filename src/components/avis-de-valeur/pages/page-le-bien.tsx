import { Calendar, Car, CheckCircle2, Home, Maximize2, Trees } from 'lucide-react'

import { A4Page } from '../a4-page'
import { KpiTile } from '../kpi-tile'
import { BLANK, formatNumber, formatSurface } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

export function PageLeBien({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { property, advisor, opinion } = avis
  const roomTotal = property.roomSurfaces.reduce((total, room) => total + room.surface, 0)

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Le bien • caractéristiques"
      advisor={advisor}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2.5">
          <KpiTile
            label="Surface habitable"
            value={property.livingSurface !== null ? formatNumber(property.livingSurface) : BLANK}
            unit="m²"
            context={property.propertySubType ?? property.propertyType}
            icon={Maximize2}
          />
          <KpiTile
            label="Terrain"
            value={property.landSurface !== null ? formatNumber(property.landSurface) : BLANK}
            unit="m²"
            context={property.terraceSurface ? `Terrasse ${formatSurface(property.terraceSurface)}` : 'Emprise foncière'}
            icon={Trees}
          />
          <KpiTile
            label="Stationnement"
            value={property.parkingCount ?? BLANK}
            context="Attribut différenciant sur le secteur"
            icon={Car}
          />
          <KpiTile
            label="Construction"
            value={property.constructionYear ?? BLANK}
            context={property.condition ?? 'État à préciser'}
            icon={Calendar}
          />
        </div>

        <div className="grid grid-cols-12 items-start gap-3.5">
          <div className="col-span-7 space-y-3.5">
            <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF]/50 p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#006390]">
                <Home className="h-3.5 w-3.5 text-[#00b4ec]" />
                Présentation du bien
              </div>
              {opinion.presentation ? (
                <p className="whitespace-pre-line text-[11pt] font-normal leading-relaxed text-slate-800">
                  {opinion.presentation}
                </p>
              ) : (
                <p className="text-[11pt] italic leading-relaxed text-slate-400">
                  Présentation à rédiger avant remise du rapport.
                </p>
              )}
            </div>

            {property.roomSurfaces.length > 0 && (
              <div className="rounded-lg border border-[#CDF7FF] bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
                    Répartition des surfaces ({formatSurface(roomTotal)})
                  </span>
                  <span className="text-[9.5px] font-semibold text-slate-500">Détail par pièce</span>
                </div>

                <div className="flex h-5 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  {property.roomSurfaces.map((room) => {
                    const share = (room.surface / roomTotal) * 100
                    return (
                      <div
                        key={room.name}
                        style={{ width: `${share}%`, backgroundColor: room.color }}
                        className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap border-r border-white/30 text-[8.5px] font-bold text-white"
                      >
                        {share.toFixed(0)}%
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2">
                  {property.roomSurfaces.map((room) => (
                    <div key={room.name} className="flex items-center justify-between text-[10.5px]">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: room.color }}
                        />
                        <span className="font-medium text-slate-700">{room.name}</span>
                      </span>
                      <span className="font-bold text-[#006390]">{formatSurface(room.surface)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-5 space-y-3.5">
            {property.equipment.length > 0 && (
              <div className="rounded-lg border-b-2 border-[#00b4ec] bg-[#006390] p-3.5 text-white">
                <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-cyan-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#25CFFF]" />
                  Équipements et prestations
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {property.equipment.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#25CFFF]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[#CDF7FF] bg-[#E9FCFF] p-3.5">
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[#006390]">
                Points forts à défendre
              </div>
              {opinion.strengths.length > 0 ? (
                <ul className="space-y-1.5">
                  {opinion.strengths.map((strength) => (
                    <li key={strength} className="flex items-start gap-1.5 text-[10.5pt] leading-snug text-slate-800">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00b4ec]" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10.5pt] italic text-slate-400">Atouts différenciants à renseigner.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </A4Page>
  )
}
