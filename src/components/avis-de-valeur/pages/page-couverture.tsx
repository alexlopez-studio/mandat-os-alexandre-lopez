import { Award, ImageOff, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'

import { A4Page } from '../a4-page'
import { IadLogo } from '../iad-logo'
import { formatDate, formatSurface } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

export function PageCouverture({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { property, advisor, seller, meta } = avis

  const title = [
    property.propertySubType ?? property.propertyType,
    property.livingSurface ? `de ${formatSurface(property.livingSurface)}` : null,
    property.city ? `à ${property.city}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const addressLine = [property.address, [property.postalCode, property.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  return (
    <A4Page pageNumber={pageNumber} totalPages={totalPages} isCover advisor={advisor}>
      <div className="flex h-full w-full flex-col justify-between">
        <div className="relative flex h-[64%] w-full flex-col justify-between overflow-hidden rounded-xl border-b-4 border-[#00b4ec] bg-[#006390] p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#008EC3]/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-[#00b4ec]/20 blur-xl" />

          <div className="z-10 flex items-center justify-between">
            <IadLogo variant="white" size="lg" />
            <span className="rounded-full bg-[#00b4ec] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
              Avis de valeur
            </span>
          </div>

          <div className="z-10 my-auto pr-4">
            <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
              <ShieldCheck className="h-3.5 w-3.5 text-[#25CFFF]" />
              Analyse fondée sur les ventes réellement signées
            </span>

            <h1 className="mb-3 text-3xl font-black leading-snug tracking-tight text-white">{title}</h1>

            {addressLine && (
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100">
                <MapPin className="h-4 w-4 shrink-0 text-[#25CFFF]" />
                <span>{addressLine}</span>
              </div>
            )}

            {seller.name && (
              <p className="mt-3 text-[11px] font-medium text-cyan-100/90">
                Établi pour {seller.civility ? `${seller.civility} ` : ''}
                {seller.name}
                {meta.visitedAt ? ` — visite du ${formatDate(meta.visitedAt)}` : ''}
              </p>
            )}
          </div>

          {/* Un rapport immobilier sans photo est un handicap réel face à un confrère qui en met une. */}
          <div className="relative z-10 h-28 w-full overflow-hidden rounded-lg border-2 border-white/20">
            {property.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={property.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center gap-2 bg-[#004f73] text-[10px] font-semibold text-cyan-200">
                <ImageOff className="h-4 w-4" />
                Photo du bien à ajouter
              </div>
            )}
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-[#006390]/80 via-transparent to-transparent p-2.5">
              <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                {[
                  property.propertyType,
                  property.livingSurface ? formatSurface(property.livingSurface) : null,
                  property.roomsCount ? `${property.roomsCount} pièces` : null,
                  property.landSurface ? `terrain ${formatSurface(property.landSurface)}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto flex h-[32%] w-full items-center justify-between rounded-xl border border-[#CDF7FF] bg-[#E9FCFF]/90 p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {advisor.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={advisor.photoUrl}
                  alt=""
                  className="h-20 w-20 rounded-full border-2 border-[#00b4ec] object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#00b4ec] bg-white text-lg font-black text-[#006390]">
                  AL
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 rounded-full border border-white bg-[#006390] p-1">
                <Award className="h-3.5 w-3.5 text-[#25CFFF]" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#008EC3]">
                Votre conseiller en immobilier iad
              </div>
              <h3 className="text-base font-extrabold leading-tight text-[#006390]">{advisor.name}</h3>
              <p className="text-[11px] font-medium text-slate-600">{advisor.sector}</p>

              <div className="flex flex-col gap-1 pt-1.5 text-[10.5px] font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-[#00b4ec]" />
                  <span className="font-bold text-slate-900">{advisor.phone}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-[#00b4ec]" />
                  <span>{advisor.email}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-l border-[#CDF7FF] pl-4 text-right">
            <IadLogo variant="cyan" size="md" />
            <div className="space-y-0.5 text-[9px] text-slate-500">
              <p className="font-semibold text-[#006390]">{advisor.rsac}</p>
              <p>Document établi le {formatDate(meta.generatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </A4Page>
  )
}
