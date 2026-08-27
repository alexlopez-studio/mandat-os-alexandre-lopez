'use client'

import * as React from 'react'
import {
  PrinterIcon,
  Share2Icon,
  MailIcon,
  CheckCircle2Icon,
  FileCheck2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BonDeVisite, VisitorInfo } from '@/lib/bon-de-visite/types'
import {
  IAD_FRANCE_HEADQUARTERS,
  BON_DE_VISITE_ADVISOR,
  OFFICIAL_DOCUMENT_HEADER,
  OFFICIAL_ENGAGEMENT_TEXT,
  OFFICIAL_PRESTATAIRE_LEGAL_TEXT,
  OFFICIAL_RISQUES_ET_ENVIRONNEMENT_TEXT,
  OFFICIAL_DONNEES_PERSONNELLES_TEXT,
  OFFICIAL_BLOCTEL_TEXT,
  OFFICIAL_DECHARGE_TEXT,
} from '@/lib/bon-de-visite/legal'
import { toast } from 'sonner'

export function BonDeVisiteDocument({
  bon,
  publicToken,
}: {
  bon: BonDeVisite
  publicToken?: string
}) {
  const [isResending, setIsResending] = React.useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleShare = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator
        .share({
          title: `${OFFICIAL_DOCUMENT_HEADER.title} - ${bon.reference}`,
          text: `Bon de recherche et de visite officiel pour ${bon.property_city}`,
          url,
        })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Lien copié dans le presse-papier')
    }
  }

  const handleResendEmails = async () => {
    setIsResending(true)
    try {
      const res = await fetch(`/api/market/bons-de-visite/${bon.id}/resend`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du renvoi')
      toast.success(`${data.sent_count} email(s) renvoyé(s) avec succès`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setIsResending(false)
    }
  }

  const formatDateFr = (iso: string) => {
    try {
      const d = new Date(iso)
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d)
    } catch {
      return iso
    }
  }

  const formatTimeFr = (iso: string) => {
    try {
      const d = new Date(iso)
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return ''
    }
  }

  const firstVisitor = bon.visitors[0] || {
    first_name: '',
    last_name: '',
    cni_number: '',
    email: '',
    phone: '',
    address: '',
  }

  const formatIdDoc = (v: VisitorInfo) => {
    const typeLabel =
      v.id_type === 'passeport'
        ? 'Passeport'
        : v.id_type === 'permis'
        ? 'Permis'
        : v.id_type === 'titre_sejour'
        ? 'Titre de séjour'
        : v.id_type === 'autre'
        ? "Pièce d'identité"
        : 'CNI'
    return `${typeLabel} n° ${v.cni_number}`
  }

  const allNames = bon.visitors.map((v) => `${v.first_name} ${v.last_name}`).join(', ')
  const allCni = bon.visitors
    .map((v) => `${v.first_name} ${v.last_name} (${formatIdDoc(v)})`)
    .join(' ; ')

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Barre d'outils (invisible à l'impression) */}
      <div className="print:hidden w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCheck2Icon className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">
              Document officiel iad · {bon.reference}
            </span>
            <span className="text-xs text-muted-foreground">
              {OFFICIAL_DOCUMENT_HEADER.footerDocRef}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-xs"
          >
            <Share2Icon className="size-3.5 mr-1" />
            Partager
          </Button>

          {bon.id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResendEmails}
              disabled={isResending}
              className="text-xs"
            >
              <MailIcon className="size-3.5 mr-1" />
              {isResending ? 'Envoi...' : 'Renvoyer emails'}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="text-xs"
          >
            <PrinterIcon className="size-3.5 mr-1" />
            Imprimer / PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENT OFFICIEL A4 IAD FRANCE */}
      <div
        className="w-full max-w-4xl rounded-xl border border-neutral-300 bg-white p-6 sm:p-10 shadow-sm text-neutral-900 print:border-none print:shadow-none print:p-0 print:m-0 print:text-black print:bg-white"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        }}
      >
        {/* En-tête officiel IAD France */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-neutral-500">
              {OFFICIAL_DOCUMENT_HEADER.code}
            </span>
          </div>

          {/* Logo iad officiel */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <svg width="42" height="32" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 28C22 21.3726 27.3726 16 34 16C40.6274 16 46 21.3726 46 28V52C46 58.6274 40.6274 64 34 64C27.3726 64 22 58.6274 22 52V28Z" stroke="#0077B6" strokeWidth="8"/>
                <path d="M54 28C54 21.3726 59.3726 16 66 16C72.6274 16 78 21.3726 78 28V52C78 58.6274 72.6274 64 66 64C59.3726 64 54 58.6274 54 52V28Z" stroke="#00A896" strokeWidth="8"/>
                <circle cx="34" cy="40" r="6" fill="#0077B6"/>
                <circle cx="66" cy="40" r="6" fill="#00A896"/>
              </svg>
              <span className="text-2xl font-black tracking-tight text-[#0077B6]">
                iad
              </span>
            </div>
          </div>

          {/* Encadré ID Conseiller */}
          <div className="border border-neutral-400 px-4 py-1.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block">
              ID DU CONSEILLER
            </span>
            <span className="font-mono text-xs font-bold text-neutral-900">
              {bon.advisor_rsac ? '908 906 423' : BON_DE_VISITE_ADVISOR.idConseiller}
            </span>
          </div>
        </div>

        {/* Titre et sous-titre officiel */}
        <div className="text-center py-4">
          <h1 className="text-base sm:text-lg font-black tracking-normal text-sky-700 uppercase">
            {OFFICIAL_DOCUMENT_HEADER.title}
          </h1>
          <p className="text-[11px] italic text-neutral-600 mt-0.5">
            {OFFICIAL_DOCUMENT_HEADER.subtitle}
          </p>
        </div>

        {/* SECTION 1 : LE VISITEUR */}
        <div className="mb-4">
          <div className="bg-sky-800 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-1.5 inline-block">
            LE VISITEUR
          </div>

          <div className="border border-neutral-400 p-2 text-[11px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="font-semibold">Nom : </span>
                <span className="font-bold">{firstVisitor.last_name || '—'}</span>
              </div>
              <div>
                <span className="font-semibold">Adresse domicile : </span>
                <span>{firstVisitor.address || bon.property_address || '—'}</span>
              </div>

              <div>
                <span className="font-semibold">Prénom : </span>
                <span className="font-bold">{firstVisitor.first_name || '—'}</span>
              </div>
              <div>
                <span className="font-semibold">Pays : </span>
                <span>France</span>
              </div>

              <div>
                <span className="font-semibold">Tél. : </span>
                <span>{firstVisitor.phone || '—'}</span>
              </div>
              <div>
                <span className="font-semibold">E-mail : </span>
                <span>{firstVisitor.email || '—'}</span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-neutral-300">
              <span className="font-semibold">
                Type(s) et numéro(s) de la (des) pièce(s) d’identité du (des) Visiteur(s) :{' '}
              </span>
              <span className="font-mono text-[10.5px] font-medium">{allCni}</span>
            </div>

            {bon.visitors.length > 1 && (
              <div className="mt-1 pt-1 border-t border-neutral-200 text-[10px] text-neutral-600">
                <span className="font-semibold">Tous les visiteurs enregistrés : </span>
                {allNames} ({bon.visitors_count} personnes)
              </div>
            )}
          </div>
        </div>

        {/* ENGAGEMENTS DU VISITEUR */}
        <div className="text-[10px] leading-snug text-neutral-800 space-y-1 mb-4 text-justify">
          <p>
            Agissant en tant qu’acquéreurs/locataires éventuels, reconnaissons avoir demandé et reçu à l’instant du Prestataire de services, les noms, adresses et conditions de vente/location des affaires référencées ci-dessous. Nous déclarons que ces affaires nous ont été présentées en premier lieu par le Prestataire de services et que nous n’en avions aucune connaissance auparavant. En conséquence, je (nous nous) (m’)engage(ons) expressément :
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>A ne communiquer à personne ces renseignements qui me (nous) sont donnés à titre personnel et confidentiel ;</li>
            <li>A informer de notre visite de ce jour toute personne ou professionnel qui pourrait à l’avenir me (nous) présenter le même bien ;</li>
            <li>A ne traiter l’achat/la location de l’une de ces affaires que par votre seul intermédiaire, même après expiration du mandat qui vous a été confié.</li>
          </ul>
          <p className="font-semibold">
            En cas de violation des engagements ci-dessus, je serai (nous serons) tenu(s) à l’entière réparation du préjudice causé au Prestataire de services par son éviction. Ce préjudice ne pouvant être inférieur à la commission que vous auriez perçue en concourant à l’acte. Le présent engagement cessera de produire ses effets à l’issue d’une période de 12 mois à compter du jour de sa signature.
          </p>
        </div>

        {/* SECTION 2 : LE PRESTATAIRE DE SERVICES */}
        <div className="mb-4">
          <div className="bg-sky-800 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-1.5 inline-block">
            LE PRESTATAIRE DE SERVICES
          </div>

          <div className="text-[9.5px] leading-tight text-neutral-700 mb-1.5 text-justify">
            {OFFICIAL_PRESTATAIRE_LEGAL_TEXT}
          </div>

          <div className="border border-neutral-400 p-2 text-[10.5px]">
            <div className="grid grid-cols-1 gap-y-1">
              <div>
                <span className="font-semibold">Nom et Prénom du conseiller I@D : </span>
                <span className="font-bold text-neutral-900">{bon.advisor_name}</span>
              </div>
              <div className="text-[9.5px] text-neutral-700">
                Exerçant sous le statut d’agent commercial mandataire indépendant en immobilier (sans détention de fonds) affilié au réseau I@D France,
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold">Immatriculé au RSAC du Tribunal de commerce de : </span>
                  <span className="font-medium">Draguignan</span>
                </div>
                <div>
                  <span className="font-semibold">sous le n° : </span>
                  <span className="font-mono font-bold">908 906 423</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold">Téléphone : </span>
                  <span>{bon.advisor_phone}</span>
                </div>
                <div>
                  <span className="font-semibold">Adresse e-mail : </span>
                  <span>{bon.advisor_email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3 : DÉSIGNATION ET ADRESSE DU BIEN */}
        <div className="mb-4">
          <div className="bg-sky-800 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-1.5 inline-block">
            DÉSIGNATION(S) ET ADRESSE(S) COMMUNIQUÉE(S) DU/DES BIEN(S) VISITÉ(S)
          </div>

          <table className="w-full border-collapse border border-neutral-400 text-[10.5px]">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-400 text-center font-bold">
                <th className="border border-neutral-400 p-1.5 w-1/4">Nature du bien</th>
                <th className="border border-neutral-400 p-1.5 w-2/5">Adresse</th>
                <th className="border border-neutral-400 p-1.5 w-1/5">Ville</th>
                <th className="border border-neutral-400 p-1.5 w-1/6">Références</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center">
                <td className="border border-neutral-400 p-1.5 font-medium">
                  {bon.property_type || 'Bien immobilier'}
                </td>
                <td className="border border-neutral-400 p-1.5 text-left font-medium">
                  {bon.property_address}
                </td>
                <td className="border border-neutral-400 p-1.5 font-medium">
                  {bon.property_zipcode ? `${bon.property_zipcode} ` : ''}
                  {bon.property_city}
                </td>
                <td className="border border-neutral-400 p-1.5 font-mono text-[10px]">
                  {bon.mandate_ref || bon.reference}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Mentions sous tableau */}
          <div className="mt-2 space-y-1 text-[9.5px] leading-tight text-neutral-700">
            <div className="flex items-start gap-1.5">
              <span className="inline-block border border-neutral-500 size-3 shrink-0 mt-0.5" />
              <span>
                Le cas échéant, je reconnais avoir été parfaitement informé(e) que {bon.advisor_name}, agent commercial indépendant du réseau iad France, est propriétaire du bien mentionné dans le présent bon de visite.
              </span>
            </div>
            <p className="text-justify">
              {OFFICIAL_RISQUES_ET_ENVIRONNEMENT_TEXT}
            </p>
          </div>
        </div>

        {/* SECTION 4 : DONNÉES PERSONNELLES & MÉDIATION */}
        <div className="mb-3 text-[9px] leading-tight text-neutral-700 space-y-1 text-justify">
          <div className="text-sky-800 font-bold uppercase text-[9.5px]">
            DONNÉES PERSONNELLES
          </div>
          <p>{OFFICIAL_DONNEES_PERSONNELLES_TEXT}</p>
        </div>

        {/* SECTION 5 : OPPOSITION AU DÉMARCHAGE TÉLÉPHONIQUE */}
        <div className="mb-3 text-[9px] leading-tight text-neutral-700">
          <span className="text-sky-800 font-bold uppercase text-[9.5px]">
            OPPOSITION AU DÉMARCHAGE TÉLÉPHONIQUE :{' '}
          </span>
          <span>{OFFICIAL_BLOCTEL_TEXT}</span>
        </div>

        {/* DÉCHARGE ET LIEU/DATE */}
        <div className="border-t border-neutral-300 pt-2 mb-3 text-[10px]">
          <p className="italic text-neutral-800 mb-1.5">
            {OFFICIAL_DECHARGE_TEXT}
          </p>
          <div className="flex justify-between items-center font-semibold">
            <div>
              <span>À </span>
              <span className="font-bold underline px-1">{bon.property_city}</span>
            </div>
            <div>
              <span>Le </span>
              <span className="font-mono font-bold underline px-1">{formatDateFr(bon.visit_at)}</span>
              {formatTimeFr(bon.visit_at) && (
                <span className="text-[9.5px] text-neutral-600 font-normal">
                  {' '}à {formatTimeFr(bon.visit_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BLOC DOUBLE SIGNATURE */}
        <div className="grid grid-cols-2 gap-4 border border-neutral-400 p-3 min-h-32 mb-4">
          {/* Colonne Visiteur */}
          <div className="flex flex-col justify-between border-r border-neutral-300 pr-2">
            <div>
              <div className="text-center font-bold text-xs uppercase text-neutral-900">
                LE VISITEUR
              </div>
              <div className="text-center text-[10px] italic text-neutral-600 mb-1">
                Ecrire « Lu et approuvé »
              </div>
            </div>

            <div className="flex flex-col items-center justify-center my-auto py-1">
              <span className="text-[10px] italic text-neutral-700 mb-0.5">
                « Lu et approuvé »
              </span>
              {bon.signature_data_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bon.signature_data_url}
                  alt={`Signature de ${bon.signer_name}`}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-neutral-400 italic">Signature</span>
              )}
            </div>

            <div className="text-[9px] text-neutral-500 text-center">
              Signé par {bon.signer_name}
            </div>
          </div>

          {/* Colonne Prestataire de services */}
          <div className="flex flex-col justify-between pl-2">
            <div>
              <div className="text-center font-bold text-xs uppercase text-neutral-900">
                LE PRESTATAIRE DE SERVICES
              </div>
              <div className="text-center text-[10px] text-neutral-600 mb-1">
                iad France · {bon.advisor_name}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center my-auto py-1 text-center">
              <div className="border border-dashed border-neutral-300 rounded p-1.5 text-[9.5px] text-neutral-600 w-full max-w-44">
                <span className="font-bold text-primary block">{bon.advisor_name}</span>
                <span className="text-[8.5px] text-neutral-500 block">Agent Commercial iad France</span>
                <span className="text-[8.5px] text-neutral-500 block">{bon.advisor_rsac}</span>
                <span className="text-[8px] text-emerald-700 font-semibold block mt-0.5">
                  ✓ Document certifié numériquement
                </span>
              </div>
            </div>

            <div className="text-[9px] text-neutral-500 text-center">
              Réf. {bon.reference}
            </div>
          </div>
        </div>

        {/* PIED DE PAGE OFFICIEL */}
        <div className="border-t border-neutral-300 pt-2 flex justify-between items-center text-[9px] text-neutral-500">
          <span>Page 1 sur 1</span>
          <span>{OFFICIAL_DOCUMENT_HEADER.footerDocRef}</span>
        </div>
      </div>
    </div>
  )
}
