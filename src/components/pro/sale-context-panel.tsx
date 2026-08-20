'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChipGroup } from '@/components/pro/chip-group'
import { Panel } from '@/components/pro/panel'
import { ToggleChip } from '@/components/pro/toggle-chip'
import { documentRequirementsFor } from '@/lib/market/document-requirements'
import {
  ASSAINISSEMENTS,
  DPE_CLASSES,
  EMPTY_SALE_CONTEXT,
  EQUIPEMENTS,
  ETATS_ELECTRICITE,
  ETATS_GAZ,
  PERMIS_PERIODES,
  PROPERTY_TYPE_KEYS,
  REGIMES,
  SALE_SITUATIONS,
  ZONES_RISQUE,
  normalizePropertyType,
  parseSaleContext,
  type Equipement,
  type PropertyTypeKey,
  type SaleContext,
  type SaleSituation,
  type ZoneRisque,
} from '@/lib/market/sale-context'

/**
 * Saisie du contexte de vente, sur la fiche projet.
 *
 * Le contexte appartient au PROJET et non au dossier client : il se renseigne
 * des la visite d'estimation, avant meme qu'un suivi client existe, pour
 * arriver au rendez-vous mandat avec la liste des pieces deja etablie.
 *
 * Sauvegarde explicite et non automatique : ce formulaire pilote une
 * soixantaine de propositions, une faute de clic ne doit pas requalifier le
 * dossier en silence.
 */

const PROPERTY_TYPE_LABEL: Record<PropertyTypeKey, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  terrain: 'Terrain',
  immeuble: 'Immeuble',
  autre: 'Autre',
}

const REGIME_LABEL: Record<(typeof REGIMES)[number], string> = {
  copropriete: 'Copropriété',
  monopropriete: 'Monopropriété',
  inconnu: 'À déterminer',
}

const SITUATION_LABEL: Record<SaleSituation, string> = {
  succession: 'Succession',
  indivision: 'Indivision',
  divorce: 'Divorce',
  sci: 'SCI',
  vefa: 'Livré en VEFA',
  viager: 'Viager',
  loue: 'Bien loué',
  protection_juridique: 'Majeur protégé',
  non_resident_fiscal: 'Vendeur non-résident',
  residence_secondaire: 'Résidence secondaire',
}

const EQUIPEMENT_LABEL: Record<Equipement, string> = {
  piscine: 'Piscine',
  veranda: 'Véranda',
  cheminee: 'Cheminée / insert',
  panneaux_solaires: 'Panneaux solaires',
}

const ZONE_LABEL: Record<ZoneRisque, string> = {
  termites: 'Zone termites',
  merule: 'Zone mérule',
  bruit_aerien: 'Zone de bruit aérien',
  argile: "Zone d'argile",
  lotissement: 'Lotissement',
}

const PERMIS_LABEL: Record<(typeof PERMIS_PERIODES)[number], string> = {
  avant_1949: 'Avant 1949',
  de_1949_a_1997: 'De 1949 à 1997',
  apres_1997: 'Après 1997',
  inconnu: 'Inconnue',
}

const DPE_LABEL: Record<(typeof DPE_CLASSES)[number], string> = {
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G',
  vierge: 'Vierge',
  inconnu: 'Inconnue',
}

const ELECTRICITE_LABEL: Record<(typeof ETATS_ELECTRICITE)[number], string> = {
  moins_15_ans: 'Moins de 15 ans',
  plus_15_ans_ou_inconnu: 'Plus de 15 ans ou inconnue',
  sans_objet: 'Sans objet',
}

const GAZ_LABEL: Record<(typeof ETATS_GAZ)[number], string> = {
  absent: 'Pas de gaz',
  moins_15_ans: 'Moins de 15 ans',
  plus_15_ans_ou_inconnu: 'Plus de 15 ans ou inconnue',
}

const ASSAINISSEMENT_LABEL: Record<(typeof ASSAINISSEMENTS)[number], string> = {
  collectif: 'Collectif',
  non_collectif: 'Non collectif',
  inconnu: 'À déterminer',
}

type SaleContextPanelProps = {
  projectId: string
  /** Type de bien de la fiche, qui pre-remplit la premiere question. */
  propertyType?: string | null
  /** Notifie la fiche pour qu'elle rafraichisse la liste des pieces. */
  onSaved?: (context: SaleContext) => void
}

export function SaleContextPanel({ projectId, propertyType, onSaved }: SaleContextPanelProps) {
  const [draft, setDraft] = useState<SaleContext>(EMPTY_SALE_CONTEXT)
  const [saved, setSaved] = useState<SaleContext>(EMPTY_SALE_CONTEXT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/projects/${projectId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur API')

      const parsed = parseSaleContext(json.project?.sale_context)
      const base = parsed.ok ? parsed.value : EMPTY_SALE_CONTEXT
      const withFallback: SaleContext = {
        ...base,
        property_type:
          base.property_type ?? normalizePropertyType(propertyType ?? json.project?.property_type),
      }
      setDraft(withFallback)
      setSaved(withFallback)
    } catch (err) {
      console.error('[SaleContextPanel] load:', err)
      toast.error('Impossible de charger le contexte de vente')
    } finally {
      setLoading(false)
    }
  }, [projectId, propertyType])

  useEffect(() => {
    void load()
  }, [load])

  // Le moteur est pur et isomorphe : le compteur se calcule sans aller-retour.
  const expectedCount = useMemo(() => documentRequirementsFor(draft).length, [draft])
  const dirty = useMemo(() => !sameContext(draft, saved), [draft, saved])

  function patch(changes: Partial<SaleContext>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/market/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_context: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur API')

      const parsed = parseSaleContext(json.project?.sale_context)
      const next = parsed.ok ? parsed.value : draft
      setDraft(next)
      setSaved(next)
      toast.success('Contexte de vente enregistré')
      onSaved?.(next)
    } catch (err) {
      console.error('[SaleContextPanel] save:', err)
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Panel title="Contexte de vente" description="Chargement…">
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement…
        </div>
      </Panel>
    )
  }

  return (
    <Panel
      title="Contexte de vente"
      description="Il détermine la liste des pièces à réunir. À renseigner dès la visite d'estimation."
      actions={
        <>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {expectedCount} pièce{expectedCount > 1 ? 's' : ''}
          </span>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Enregistrer
          </Button>
        </>
      }
    >
      <ChipGroup label="Type de bien">
        {PROPERTY_TYPE_KEYS.map((key) => (
          <ToggleChip
            key={key}
            selected={draft.property_type === key}
            onClick={() => patch({ property_type: draft.property_type === key ? null : key })}
          >
            {PROPERTY_TYPE_LABEL[key]}
          </ToggleChip>
        ))}
      </ChipGroup>

      <ChipGroup
        label="Régime"
        hint="La copropriété appelle le mesurage Carrez, les PV d'AG et le pré-état daté."
      >
        {REGIMES.map((key) => (
          <ToggleChip key={key} selected={draft.regime === key} onClick={() => patch({ regime: key })}>
            {REGIME_LABEL[key]}
          </ToggleChip>
        ))}
      </ChipGroup>

      <ChipGroup label="Situation de vente" hint="Cumulables.">
        {SALE_SITUATIONS.map((key) => (
          <ToggleChip
            key={key}
            selected={draft.situations.includes(key)}
            onClick={() => patch({ situations: toggle(draft.situations, key) })}
          >
            {SITUATION_LABEL[key]}
          </ToggleChip>
        ))}
      </ChipGroup>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Période du permis de construire"
          hint="Elle commande le plomb (avant 1949) et l'amiante (avant 1997)."
          value={draft.permis_periode}
          options={PERMIS_PERIODES}
          labels={PERMIS_LABEL}
          onChange={(value) => patch({ permis_periode: value })}
        />
        <Field
          label="Classe DPE"
          hint="E, F ou G déclenchent l'audit énergétique hors copropriété."
          value={draft.dpe_classe}
          options={DPE_CLASSES}
          labels={DPE_LABEL}
          onChange={(value) => patch({ dpe_classe: value })}
        />
        <Field
          label="Installation électrique"
          value={draft.electricite}
          options={ETATS_ELECTRICITE}
          labels={ELECTRICITE_LABEL}
          onChange={(value) => patch({ electricite: value })}
        />
        <Field
          label="Installation gaz"
          value={draft.gaz}
          options={ETATS_GAZ}
          labels={GAZ_LABEL}
          onChange={(value) => patch({ gaz: value })}
        />
        <Field
          label="Assainissement"
          value={draft.assainissement}
          options={ASSAINISSEMENTS}
          labels={ASSAINISSEMENT_LABEL}
          onChange={(value) => patch({ assainissement: value })}
        />
      </div>

      <ChipGroup
        label="Travaux et équipements"
        hint="Des travaux de moins de dix ans appellent la DAACT et l'assurance dommages-ouvrage."
      >
        <ToggleChip
          selected={draft.travaux_recents}
          onClick={() => patch({ travaux_recents: !draft.travaux_recents })}
        >
          Travaux de moins de 10 ans
        </ToggleChip>
        {EQUIPEMENTS.map((key) => (
          <ToggleChip
            key={key}
            selected={draft.equipements.includes(key)}
            onClick={() => patch({ equipements: toggle(draft.equipements, key) })}
          >
            {EQUIPEMENT_LABEL[key]}
          </ToggleChip>
        ))}
      </ChipGroup>

      <ChipGroup
        label="Zones et servitudes"
        hint="Termites, mérule et bruit aérien dépendent de l'arrêté préfectoral applicable à la commune : à vérifier au cas par cas."
      >
        {ZONES_RISQUE.map((key) => (
          <ToggleChip
            key={key}
            selected={draft.zones.includes(key)}
            onClick={() => patch({ zones: toggle(draft.zones, key) })}
          >
            {ZONE_LABEL[key]}
          </ToggleChip>
        ))}
      </ChipGroup>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-foreground" htmlFor="sale-context-note">
          Note
        </label>
        <Textarea
          id="sale-context-note"
          value={draft.note ?? ''}
          onChange={(event) => patch({ note: event.target.value || null })}
          placeholder="À confirmer avec le notaire, syndic injoignable…"
          className="min-h-20 text-sm"
        />
      </div>

      {saved.updated_at ? (
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour le{' '}
          {new Date(saved.updated_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Contexte pas encore enregistré : la liste des pièces reste indisponible côté dossier.
        </p>
      )}
    </Panel>
  )
}

type FieldProps<T extends string> = {
  label: string
  hint?: string
  value: T
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}

function Field<T extends string>({ label, hint, value, options, labels, onChange }: FieldProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Comparaison de forme, pour n'activer « Enregistrer » que sur un vrai ecart. */
function sameContext(left: SaleContext, right: SaleContext): boolean {
  return (
    left.property_type === right.property_type &&
    left.regime === right.regime &&
    left.permis_periode === right.permis_periode &&
    left.dpe_classe === right.dpe_classe &&
    left.electricite === right.electricite &&
    left.gaz === right.gaz &&
    left.assainissement === right.assainissement &&
    left.travaux_recents === right.travaux_recents &&
    left.note === right.note &&
    sameList(left.situations, right.situations) &&
    sameList(left.equipements, right.equipements) &&
    sameList(left.zones, right.zones)
  )
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index])
}
