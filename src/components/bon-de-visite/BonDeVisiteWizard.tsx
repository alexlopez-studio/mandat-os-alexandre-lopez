'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Building2Icon,
  UserPlusIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ChevronLeftIcon,
  Share2Icon,
  UsersIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  PlusIcon,
  MinusIcon,
  FileCheck2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SignaturePad } from './SignaturePad'
import { OFFICIAL_ENGAGEMENT_TEXT } from '@/lib/bon-de-visite/legal'
import {
  IDENTITY_DOC_LABELS,
  type BonDeVisite,
  type VisitorInfo,
  type IdentityDocType,
} from '@/lib/bon-de-visite/types'
import { toast } from 'sonner'

type ProjectOption = {
  id: string
  reference: string
  title: string
  display_title?: string
  property_city?: string
  property_type?: string
  estimated_price_min?: number
  estimated_price_max?: number
  contacts?: Array<{ name: string; phone?: string; email?: string }>
}

export function BonDeVisiteWizard({
  initialProjectId,
  onComplete,
}: {
  initialProjectId?: string
  onComplete?: (bon: BonDeVisite) => void
}) {
  // Projets en vente disponibles
  const [projects, setProjects] = React.useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = React.useState(true)

  // Étape 1 : Bien & Nombre de visiteurs
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(initialProjectId || '')
  const [isManualProperty, setIsManualProperty] = React.useState(false)
  const [propertyAddress, setPropertyAddress] = React.useState('')
  const [propertyCity, setPropertyCity] = React.useState('')
  const [propertyZipcode, setPropertyZipcode] = React.useState('')
  const [propertyType, setPropertyType] = React.useState('Maison')
  const [propertyPrice, setPropertyPrice] = React.useState<number | undefined>(undefined)
  const [mandateRef, setMandateRef] = React.useState('')
  const [visitorsCount, setVisitorsCount] = React.useState(1)

  // Visiteurs
  const [visitors, setVisitors] = React.useState<VisitorInfo[]>([
    {
      first_name: '',
      last_name: '',
      id_type: 'cni',
      cni_number: '',
      email: '',
      phone: '',
      address: '',
    },
  ])

  // Navigation des étapes :
  // Step 0: Bien & Nombre de visiteurs
  // Step 1 à N: Visiteur 1 à Visiteur N
  // Step N+1: Signature tactile
  // Step N+2: Confirmation
  const [step, setStep] = React.useState(0)

  // Signature
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null)
  const [signerIndex, setSignerIndex] = React.useState(0)

  // États de soumission
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [createdBon, setCreatedBon] = React.useState<BonDeVisite | null>(null)

  // Chargement des projets en portefeuille
  React.useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/market/opportunities?limit=50')
        if (res.ok) {
          const data = await res.json()
          const opps: ProjectOption[] = data.opportunities || []
          setProjects(opps)

          // Si initialProjectId fourni, pré-remplir
          if (initialProjectId) {
            const found = opps.find((p) => p.id === initialProjectId)
            if (found) {
              setSelectedProjectId(found.id)
              setPropertyAddress(found.display_title || found.title || '')
              setPropertyCity(found.property_city || '')
              setPropertyType(found.property_type || 'Maison')
              setMandateRef(found.reference || '')
              if (found.estimated_price_min || found.estimated_price_max) {
                setPropertyPrice(found.estimated_price_min || found.estimated_price_max)
              }
            }
          }
        }
      } catch (err) {
        console.error('Erreur chargement projets:', err)
      } finally {
        setLoadingProjects(false)
      }
    }
    loadProjects()
  }, [initialProjectId])

  // Gestion du choix d'un projet dans le dropdown
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (!projectId) return

    const p = projects.find((item) => item.id === projectId)
    if (p) {
      setPropertyAddress(p.display_title || p.title || '')
      setPropertyCity(p.property_city || '')
      setPropertyType(p.property_type || 'Maison')
      setMandateRef(p.reference || '')
      if (p.estimated_price_min || p.estimated_price_max) {
        setPropertyPrice(p.estimated_price_min || p.estimated_price_max)
      }
      setIsManualProperty(false)
    }
  }

  // Ajustement du nombre de visiteurs
  const handleSetVisitorsCount = (count: number) => {
    const validCount = Math.max(1, Math.min(6, count))
    setVisitorsCount(validCount)

    setVisitors((prev) => {
      const next = [...prev]
      while (next.length < validCount) {
        next.push({
          first_name: '',
          last_name: '',
          id_type: 'cni',
          cni_number: '',
          email: '',
          phone: '',
          address: '',
        })
      }
      return next.slice(0, validCount)
    })
  }

  const updateVisitorField = (index: number, field: keyof VisitorInfo, value: string) => {
    setVisitors((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
  }

  // Validation étape 0 (Bien)
  const validateStep0 = () => {
    if (!selectedProjectId && !isManualProperty) {
      toast.error('Veuillez sélectionner un projet ou saisir une adresse')
      return false
    }
    if (isManualProperty && (!propertyAddress.trim() || !propertyCity.trim())) {
      toast.error("Veuillez indiquer l'adresse et la commune du bien")
      return false
    }
    return true
  }

  // Validation étape visiteur X
  const validateVisitorStep = (visitorIdx: number) => {
    const v = visitors[visitorIdx]
    if (!v) return false

    if (!v.first_name.trim() || !v.last_name.trim()) {
      toast.error(`Veuillez indiquer le prénom et le nom du visiteur #${visitorIdx + 1}`)
      return false
    }
    if (!v.cni_number.trim()) {
      toast.error(
        `Veuillez renseigner le numéro de la pièce d'identité du visiteur #${visitorIdx + 1}`
      )
      return false
    }
    if (v.email && v.email.trim() && !v.email.includes('@')) {
      toast.error(`Adresse e-mail invalide pour le visiteur #${visitorIdx + 1}`)
      return false
    }
    return true
  }

  // Soumission finale
  const handleSubmit = async () => {
    if (!signatureDataUrl) {
      toast.error('La signature tactile du visiteur est obligatoire')
      return
    }

    const signer = visitors[signerIndex] || visitors[0]
    const signerName = `${signer.first_name} ${signer.last_name}`.trim()

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/market/bons-de-visite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId || null,
          property_address: propertyAddress.trim(),
          property_city: propertyCity.trim(),
          property_zipcode: propertyZipcode.trim() || null,
          property_type: propertyType || null,
          property_price: propertyPrice || null,
          mandate_ref: mandateRef.trim() || null,
          visit_at: new Date().toISOString(), // Horodatage automatique à la validation
          visitors,
          signature_data_url: signatureDataUrl,
          signer_name: signerName,
          notes: null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création du bon de visite')
      }

      setCreatedBon(data.bon)
      setStep(visitorsCount + 1) // Passe à l'écran de confirmation
      toast.success(`Bon de visite ${data.bon.reference} certifié avec succès`)

      if (onComplete) {
        onComplete(data.bon)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de validation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setSignatureDataUrl(null)
    setCreatedBon(null)
    setVisitors([
      {
        first_name: '',
        last_name: '',
        id_type: 'cni',
        cni_number: '',
        email: '',
        phone: '',
        address: '',
      },
    ])
    setVisitorsCount(1)
  }

  // --- ÉCRAN FINAL : CONFIRMATION ---
  if (createdBon && step === visitorsCount + 1) {
    const publicUrl = `/bon-de-visite/${createdBon.token}`
    return (
      <div className="flex flex-col items-center gap-6 text-center py-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <CheckCircle2Icon className="size-10" />
        </div>

        <div className="space-y-1">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            {createdBon.reference}
          </span>
          <h2 className="text-xl font-extrabold text-foreground">
            Bon de visite certifié & signé !
          </h2>
          <p className="text-xs text-muted-foreground max-w-md">
            Le document officiel iad a été généré, certifié numériquement et archivé dans Mandat OS.
          </p>
        </div>

        {/* Détails */}
        <div className="w-full rounded-xl border border-border bg-card p-4 text-left text-xs space-y-2">
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Bien :</span>
            <strong className="text-foreground">
              {createdBon.property_address}, {createdBon.property_city}
            </strong>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Signataire :</span>
            <strong className="text-foreground">{createdBon.signer_name}</strong>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Nombre de visiteurs :</span>
            <span className="font-semibold text-foreground">{createdBon.visitors_count}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Envoi email acquéreurs :</span>
            <span className="text-emerald-600 font-bold">
              {createdBon.email_status === 'sent' ? '✓ Email envoyé' : 'Enregistré'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button asChild className="flex-1 text-xs font-bold">
            <Link href={publicUrl} target="_blank">
              <ExternalLinkIcon className="size-4 mr-1.5" />
              Consulter le document officiel
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="flex-1 text-xs font-semibold"
          >
            <RotateCcwIcon className="size-4 mr-1.5" />
            Nouvelle visite
          </Button>
        </div>
      </div>
    )
  }

  // --- FIL D'ARIANE / INDICATEUR D'ÉTAPE ---
  const totalSteps = 1 + visitorsCount + 1 // Bien + N visiteurs + Signature
  const stepLabel =
    step === 0
      ? '1. Bien & Visiteurs'
      : step <= visitorsCount
      ? `${step + 1}. Visiteur ${step}/${visitorsCount}`
      : `${totalSteps}. Signature tactile`

  return (
    <div className="flex flex-col gap-6">
      {/* Barre de progression épurée */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
            {step + 1}
          </div>
          <span className="text-xs font-bold text-foreground">{stepLabel}</span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          Étape {step + 1} sur {totalSteps}
        </span>
      </div>

      {/* --- ÉTAPE 0 : BIEN & NOMBRE DE VISITEURS --- */}
      {step === 0 && (
        <div className="flex flex-col gap-5">
          {/* Dropdown Projet */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-bold uppercase text-foreground">
              Projet à rattacher *
            </Label>

            {!isManualProperty ? (
              <div className="flex flex-col gap-2">
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs font-medium"
                >
                  <option value="">Sélectionner un projet en portefeuille...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.reference ? `[${p.reference}] ` : ''}
                      {p.display_title || p.title} ({p.property_city || '—'})
                    </option>
                  ))}
                </select>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualProperty(true)
                      setSelectedProjectId('')
                    }}
                    className="text-xs text-primary underline hover:text-primary/80"
                  >
                    Ou saisir une adresse manuelle
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground">Adresse manuelle</span>
                  <button
                    type="button"
                    onClick={() => setIsManualProperty(false)}
                    className="text-xs text-primary underline"
                  >
                    Revenir à la liste des projets
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Adresse (ex : 14 Rue des Lavandes)"
                      value={propertyAddress}
                      onChange={(e) => setPropertyAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Commune (ex : Barjols)"
                      value={propertyCity}
                      onChange={(e) => setPropertyCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Code postal (ex : 83670)"
                      value={propertyZipcode}
                      onChange={(e) => setPropertyZipcode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Nombre de visiteurs */}
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label className="text-xs font-bold uppercase text-foreground">
              Nombre de visiteurs *
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-border rounded-xl bg-card p-1 shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSetVisitorsCount(visitorsCount - 1)}
                  disabled={visitorsCount <= 1}
                  className="size-9 rounded-lg"
                >
                  <MinusIcon className="size-4" />
                </Button>
                <span className="w-12 text-center font-black text-lg text-foreground">
                  {visitorsCount}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSetVisitorsCount(visitorsCount + 1)}
                  disabled={visitorsCount >= 6}
                  className="size-9 rounded-lg"
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>

              <span className="text-xs text-muted-foreground">
                {visitorsCount === 1
                  ? '1 personne présente'
                  : `${visitorsCount} personnes présentes (saisie individuelle)`}
              </span>
            </div>
          </div>

          {/* Bouton Suivant */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                if (validateStep0()) {
                  setStep(1)
                }
              }}
              className="w-full text-xs font-bold h-11 rounded-xl shadow-xs"
            >
              Continuer vers Visiteur 1
              <ChevronRightIcon className="size-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* --- ÉTAPES 1 À N : SAISIE DE CHAQUE VISITEUR --- */}
      {step >= 1 && step <= visitorsCount && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-xs font-extrabold text-primary">
              Visiteur {step} sur {visitorsCount}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {propertyAddress ? `${propertyAddress}, ${propertyCity}` : propertyCity}
            </span>
          </div>

          {/* Formulaire Visiteur */}
          {(() => {
            const visitorIdx = step - 1
            const v = visitors[visitorIdx] || {
              first_name: '',
              last_name: '',
              id_type: 'cni',
              cni_number: '',
              email: '',
              phone: '',
              address: '',
            }

            return (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-bold text-foreground">Prénom *</Label>
                    <Input
                      placeholder="Ex : Jean"
                      value={v.first_name}
                      onChange={(e) => updateVisitorField(visitorIdx, 'first_name', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-bold text-foreground">Nom *</Label>
                    <Input
                      placeholder="Ex : Dupont"
                      value={v.last_name}
                      onChange={(e) => updateVisitorField(visitorIdx, 'last_name', e.target.value)}
                    />
                  </div>
                </div>

                {/* Type de pièce d'identité */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-bold text-foreground">
                      Type de pièce d'identité *
                    </Label>
                    <select
                      value={v.id_type || 'cni'}
                      onChange={(e) =>
                        updateVisitorField(
                          visitorIdx,
                          'id_type',
                          e.target.value as IdentityDocType
                        )
                      }
                      className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs font-medium"
                    >
                      <option value="cni">{IDENTITY_DOC_LABELS.cni}</option>
                      <option value="passeport">{IDENTITY_DOC_LABELS.passeport}</option>
                      <option value="permis">{IDENTITY_DOC_LABELS.permis}</option>
                      <option value="titre_sejour">{IDENTITY_DOC_LABELS.titre_sejour}</option>
                      <option value="autre">{IDENTITY_DOC_LABELS.autre}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-xs font-bold text-foreground">
                      Numéro de la pièce *
                    </Label>
                    <Input
                      placeholder="Ex : 123456789012"
                      value={v.cni_number}
                      onChange={(e) => updateVisitorField(visitorIdx, 'cni_number', e.target.value)}
                    />
                  </div>
                </div>

                {/* Contact Optionnel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <Label className="text-xs font-bold text-foreground">Adresse e-mail</Label>
                      <span className="text-[10px] text-muted-foreground font-normal">Optionnel</span>
                    </div>
                    <Input
                      type="email"
                      placeholder="jean.dupont@email.fr"
                      value={v.email || ''}
                      onChange={(e) => updateVisitorField(visitorIdx, 'email', e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <Label className="text-xs font-bold text-foreground">Téléphone</Label>
                      <span className="text-[10px] text-muted-foreground font-normal">Optionnel</span>
                    </div>
                    <Input
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={v.phone || ''}
                      onChange={(e) => updateVisitorField(visitorIdx, 'phone', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Navigation Visiteurs */}
          <div className="flex items-center justify-between gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="text-xs font-semibold"
            >
              <ChevronLeftIcon className="size-4 mr-1" />
              Précédent
            </Button>

            <Button
              type="button"
              onClick={() => {
                if (validateVisitorStep(step - 1)) {
                  setStep(step + 1)
                }
              }}
              className="text-xs font-bold"
            >
              {step < visitorsCount ? (
                <>
                  Visiteur suivant ({step + 1}/{visitorsCount})
                  <ChevronRightIcon className="size-4 ml-1" />
                </>
              ) : (
                <>
                  Passer à la signature
                  <ChevronRightIcon className="size-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* --- ÉTAPE FINALE : SIGNATURE TACTILE --- */}
      {step === visitorsCount + 1 && (
        <div className="flex flex-col gap-5">
          {/* Récapitulatif épuré */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bien :</span>
              <strong className="text-foreground">
                {propertyAddress}, {propertyCity}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visiteur(s) ({visitorsCount}) :</span>
              <strong className="text-foreground">
                {visitors.map((v) => `${v.first_name} ${v.last_name}`).join(', ')}
              </strong>
            </div>
          </div>

          {/* Engagements légaux succincts */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ShieldCheckIcon className="size-4 text-primary" />
              Engagements du visiteur (Réseau iad France · Loi Hoguet)
            </div>
            <div className="max-h-28 overflow-y-auto text-[11px] leading-snug text-muted-foreground whitespace-pre-line border-t border-border pt-1.5">
              {OFFICIAL_ENGAGEMENT_TEXT}
            </div>
          </div>

          {/* Sélection du signataire si plusieurs visiteurs */}
          {visitorsCount > 1 && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold text-foreground">
                Personne qui signe le document *
              </Label>
              <select
                value={signerIndex}
                onChange={(e) => setSignerIndex(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs font-medium"
              >
                {visitors.map((v, i) => (
                  <option key={i} value={i}>
                    {v.first_name} {v.last_name} ({v.cni_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Signature Pad Grand Format */}
          <div className="flex flex-col gap-1.5">
            <SignaturePad
              value={signatureDataUrl}
              onChange={setSignatureDataUrl}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions finales */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(visitorsCount)}
              disabled={isSubmitting}
              className="text-xs font-semibold"
            >
              <ChevronLeftIcon className="size-4 mr-1" />
              Modifier visiteurs
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !signatureDataUrl}
              className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-5 rounded-xl shadow-xs"
            >
              {isSubmitting ? (
                'Certification en cours...'
              ) : (
                <>
                  <FileCheck2Icon className="size-4 mr-1.5" />
                  Valider et certifier le bon de visite
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
