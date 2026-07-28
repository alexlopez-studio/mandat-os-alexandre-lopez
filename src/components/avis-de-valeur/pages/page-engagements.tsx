import { Globe, Instagram, Mail, MapPin, Phone } from 'lucide-react'

import { A4Page } from '../a4-page'
import { IadLogo } from '../iad-logo'
import { ADVISOR_MENTION, LEGAL_MENTION } from '@/lib/avis-de-valeur/advisor'
import { formatDate } from '@/lib/avis-de-valeur/format'
import type { AvisPageProps } from '../page-registry'
import type { AvisDeValeur } from '@/lib/avis-de-valeur/types'

export function PageEngagements({ avis, pageNumber, totalPages }: AvisPageProps) {
  const { advisor, meta, property } = avis

  return (
    <A4Page
      pageNumber={pageNumber}
      totalPages={totalPages}
      sectionTitle="Votre conseiller • engagements"
      advisor={advisor}
    >
      <div className="flex h-full flex-col gap-3.5">
        <div className="flex items-center justify-between gap-4 rounded-xl border-b-4 border-[#00b4ec] bg-[#006390] p-4 text-white">
          <div className="flex items-center gap-4">
            {advisor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={advisor.photoUrl}
                alt=""
                className="h-20 w-20 rounded-full border-2 border-[#25CFFF] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#25CFFF] bg-[#004f73] text-xl font-black">
                AL
              </div>
            )}

            <div className="space-y-1">
              <span className="rounded bg-[#00b4ec] px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-widest text-white">
                Interlocuteur unique
              </span>
              <h3 className="text-xl font-black text-white">{advisor.name}</h3>
              <p className="text-[10.5pt] font-medium text-cyan-200">{advisor.title}</p>

              <div className="flex items-center gap-3 pt-1 text-[10px] font-medium text-slate-200">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-[#25CFFF]" />
                  {advisor.phone}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-[#25CFFF]" />
                  {advisor.email}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-l border-white/20 pl-4 text-right text-[9.5px] text-slate-200">
            <span className="flex items-center justify-end gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#25CFFF]" />
              {advisor.sector}
            </span>
            <span className="flex items-center justify-end gap-1.5">
              <Globe className="h-3.5 w-3.5 text-[#25CFFF]" />
              Mini-site iad
            </span>
            <span className="flex items-center justify-end gap-1.5">
              <Instagram className="h-3.5 w-3.5 text-[#25CFFF]" />
              @alexandrelopez_iad
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Commitment
            title="Méthode"
            text="Une estimation fondée sur les ventes réellement signées, publiées par la DGFiP, et non sur les prix affichés des portails."
          />
          <Commitment
            title="Transparence"
            text="Chaque chiffre du rapport est sourcé. Ce qui n’est pas connu est laissé en blanc plutôt qu’estimé."
          />
          <Commitment
            title="Suivi"
            text="Un seul interlocuteur du premier rendez-vous à la remise des clés, et la puissance du réseau iad derrière."
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[#CDF7FF] bg-white p-3.5">
          <div>
            <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">
              Fait pour valoir ce que de droit
            </div>
            <p className="text-[9.5pt] text-slate-600">
              Avis de valeur établi le {formatDate(meta.generatedAt)}
              {property.city ? ` pour un bien situé à ${property.city}` : ''}.
            </p>
            <p className="mt-1 text-[8.5px] leading-snug text-slate-500">
              Le présent document est un avis de valeur, remis à titre d’information. Il ne constitue ni une
              expertise judiciaire, ni une garantie de prix de vente.
            </p>
          </div>

          <div className="shrink-0 border-l border-slate-100 pl-4 text-center">
            <div className="text-[9px] font-bold uppercase text-slate-500">Le conseiller</div>
            <div className="my-1 text-lg font-bold italic text-[#006390]">{advisor.name}</div>
            <IadLogo variant="cyan" size="sm" />
          </div>
        </div>

        <div className="mt-auto space-y-1.5 border-t border-[#CDF7FF] pt-2 text-[7.5px] leading-snug text-slate-500">
          <p>{LEGAL_MENTION}</p>
          <p>{ADVISOR_MENTION}</p>
        </div>
      </div>
    </A4Page>
  )
}

function Commitment({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[#CDF7FF] bg-[#E9FCFF] p-3">
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-[#006390]">{title}</div>
      <p className="text-[9.5pt] leading-snug text-slate-700">{text}</p>
    </div>
  )
}
