'use client'

import { useMemo } from 'react'
import { Check, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/pro/status-pill'
import type {
  ReconciledRequirement,
  RequirementSeverity,
} from '@/lib/market/document-requirements'
import { DOCUMENT_CATEGORY_OPTIONS } from '@/lib/market/document-requirements'
import type { SaleFlag } from '@/lib/market/sale-flags'

const SEVERITY_META: Record<
  RequirementSeverity,
  { label: string; tone: 'neutral' | 'warning' | 'danger' }
> = {
  obligatoire: { label: 'Obligatoire', tone: 'danger' },
  recommande: { label: 'Recommandé', tone: 'warning' },
  selon_cas: { label: 'Selon le cas', tone: 'neutral' },
}

/** Traduction des drapeaux pour la ligne « proposé parce que ». */
const REASON_LABEL: Partial<Record<SaleFlag, string>> = {
  copropriete: 'copropriété',
  permis_avant_1949: 'permis avant 1949',
  permis_avant_1997: 'permis avant 1997',
  elec_a_diagnostiquer: 'électricité de plus de 15 ans',
  gaz_a_diagnostiquer: 'gaz de plus de 15 ans',
  assainissement_non_collectif: 'assainissement non collectif',
  assainissement_collectif: 'assainissement collectif',
  dpe_passoire: 'DPE E, F ou G',
  travaux_recents: 'travaux récents',
  piscine: 'piscine',
  veranda: 'véranda',
  cheminee: 'cheminée',
  panneaux_solaires: 'panneaux solaires',
  zone_termites: 'zone termites',
  zone_merule: 'zone mérule',
  zone_bruit_aerien: 'zone de bruit aérien',
  zone_argile: "zone d'argile",
  lotissement: 'lotissement',
  succession: 'succession',
  indivision: 'indivision',
  divorce: 'divorce',
  sci: 'SCI',
  vefa: 'livré en VEFA',
  viager: 'viager',
  loue: 'bien loué',
  protection_juridique: 'majeur protégé',
  non_resident_fiscal: 'vendeur non-résident',
  residence_secondaire: 'résidence secondaire',
}

type RequirementListProps = {
  rows: ReconciledRequirement[]
  /** Absent = liste en lecture seule. */
  onAdd?: (key: string) => void
  busyKey?: string | null
}

/**
 * Pieces attendues, groupees par categorie.
 *
 * Le groupement n'est pas decoratif : trente-quatre lignes a plat sont
 * illisibles, et le vendeur comme le conseiller raisonnent par famille de
 * pieces (« les diagnostics », « la copropriete »).
 */
export function RequirementList({ rows, onAdd, busyKey }: RequirementListProps) {
  const groups = useMemo(() => {
    return DOCUMENT_CATEGORY_OPTIONS.map((category) => ({
      category,
      rows: rows.filter((row) => row.category === category),
    })).filter((group) => group.rows.length > 0)
  }, [rows])

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.category} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-foreground">{group.category}</h3>
          <ul className="divide-y rounded-lg border">
            {group.rows.map((row) => {
              const severity = SEVERITY_META[row.severity]
              const isPresent = row.state === 'present'
              const reasons = row.reasons
                .map((flag) => REASON_LABEL[flag] ?? flag)
                .filter(Boolean)

              return (
                <li key={row.key} className="flex flex-wrap items-center gap-4 p-4">
                  <span
                    className={
                      isPresent
                        ? 'flex size-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground'
                        : 'flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border'
                    }
                    aria-hidden="true"
                  >
                    {isPresent ? <Check className="size-4" /> : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Attendue au stade « {row.dueStage} »
                      {row.validity ? ` · validité ${row.validity}` : ''}
                      {row.legalRef ? ` · ${row.legalRef}` : ''}
                      {reasons.length > 0 ? ` · proposée parce que : ${reasons.join(', ')}` : ''}
                    </p>
                  </div>

                  <StatusPill tone={isPresent ? 'success' : severity.tone}>
                    {isPresent ? 'Au dossier' : severity.label}
                  </StatusPill>

                  {onAdd && !isPresent ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      disabled={busyKey === row.key}
                      onClick={() => onAdd(row.key)}
                      aria-label={`Ajouter ${row.label} au dossier`}
                    >
                      <Plus className="mr-2 size-4" />
                      Ajouter
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
