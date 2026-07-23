'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type DemoScenario = 'estimation_draft' | 'estimation_published' | 'mandate_signed'

type DemoStatus = {
  dossierId: string
  dossierTitle: string
  scenario: DemoScenario
  scenarioLabel: string
  previewUrl: string
}

const SCENARIOS: Array<{ id: DemoScenario; title: string; description: string }> = [
  {
    id: 'estimation_draft',
    title: 'Estimation en préparation',
    description: "L'avis de valeur est en cours de rédaction, pas encore visible du client.",
  },
  {
    id: 'estimation_published',
    title: 'Estimation publiée',
    description: "L'estimation est finalisée et consultable par le client dans son espace.",
  },
  {
    id: 'mandate_signed',
    title: 'Mandat signé, vente en cours',
    description: 'Le mandat est signé et le suivi de vente (visites, offres) est actif.',
  },
]

async function parseJson(res: Response) {
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error ?? 'Erreur inattendue')
  }
  return data.data as DemoStatus
}

export default function DemoAccountPage() {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<DemoScenario | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/market/demo/status')
      setStatus(await parseJson(res))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de charger le compte de démo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const applyScenario = async (scenario: DemoScenario) => {
    setApplying(scenario)
    try {
      const res = await fetch('/api/market/demo/apply-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      })
      const data = await parseJson(res)
      setStatus(data)
      toast.success(`Scénario appliqué : ${data.scenarioLabel}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Application du scénario impossible')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <header className="flex flex-col gap-1 border-b border-border pb-3">
          <p className="text-xs font-bold uppercase tracking-normal text-primary">Mandat OS</p>
          <h1 className="text-xl font-bold text-foreground">Compte client de démo</h1>
          <p className="text-sm text-muted-foreground">
            Un dossier client unique dont tu peux faire basculer l&apos;étape du parcours, pour une démo ou une présentation.
            Ce dossier est exclu des vraies statistiques et listes du back-office.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Étape du parcours</CardTitle>
            <CardDescription>
              {status ? `Dossier : ${status.dossierTitle}` : 'Chargement du dossier de démo…'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading && !status ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </div>
            ) : (
              SCENARIOS.map((scenario) => {
                const isCurrent = status?.scenario === scenario.id
                const isApplying = applying === scenario.id
                return (
                  <div
                    key={scenario.id}
                    className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{scenario.title}</p>
                        {isCurrent ? (
                          <Badge variant="outline" className="h-auto rounded-md border-primary/30 bg-primary/10 text-primary">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Étape actuelle
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{scenario.description}</p>
                    </div>
                    <Button
                      variant={isCurrent ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={isApplying || isCurrent}
                      onClick={() => applyScenario(scenario.id)}
                    >
                      {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                      {isCurrent ? 'Sélectionnée' : 'Appliquer'}
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {status ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aperçu client</CardTitle>
              <CardDescription>Ouvre l&apos;espace client tel que le verra ce dossier de démo, sans identifiants.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href={status.previewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir l&apos;aperçu client
                </a>
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">Le lien de prévisualisation expire au bout d&apos;une heure.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
