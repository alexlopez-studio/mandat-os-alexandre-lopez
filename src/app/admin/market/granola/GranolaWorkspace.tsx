'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Link2,
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ActionBar,
  DataToolbar,
  EmptyState,
  ErrorState,
  Grid,
  LoadingState,
  MetricCard,
  PageHeader,
  PageLayout,
  Panel,
  StatusPill,
  ToggleChip,
} from '@/components/pro'

type TranscriptRow = {
  id: string
  external_id: string
  title: string
  meeting_at: string | null
  summary: string | null
  status: 'classified' | 'needs_review' | 'ignored'
  classification_confidence: number | null
  extracted_at: string | null
  extraction_error: string | null
  link: {
    opportunity_id: string
    match_score: number | null
    match_reasons: string[] | null
    confirmed_by: string | null
    project_title: string | null
    project_reference: string | null
  } | null
  suggestion: {
    opportunity_id: string
    score: number
    reasons: string[]
    project_title: string | null
    project_reference: string | null
  } | null
}

type ProjectOption = { id: string; title: string | null; reference: string | null; property_city: string | null }

type ActionRow = {
  id: string
  title: string
  description: string | null
  action_type: string
  status: string
  risk_level: 'low' | 'medium' | 'high'
  result: Record<string, unknown> | null
  error: string | null
  executed_at: string | null
}

type StatusPayload = {
  connected: boolean
  connection: {
    status: string
    account_email: string | null
    last_synced_at: string | null
    last_error: string | null
  } | null
  freshness: { days_since_sync: number | null; stale: boolean; lost_window: boolean; message: string | null }
  settings: {
    sync_enabled: boolean
    autodispatch_enabled: boolean
    autodispatch_medium_enabled: boolean
    match_threshold: number
  }
  transcripts: { classified: number; needs_review: number; ignored: number }
  sync_runs: Array<{
    id: string
    status: string
    source: string
    started_at: string
    fetched_count: number
    created_count: number
    updated_count: number
    error_message: string | null
    blocked_reason: string | null
  }>
}

const STATUS_META: Record<TranscriptRow['status'], { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  classified: { label: 'Rattaché', tone: 'success' },
  needs_review: { label: 'À arbitrer', tone: 'warning' },
  ignored: { label: 'Ignoré', tone: 'neutral' },
}

const RISK_META: Record<ActionRow['risk_level'], { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  low: { label: 'Risque faible', tone: 'success' },
  medium: { label: 'Risque moyen', tone: 'warning' },
  high: { label: 'Validation requise', tone: 'danger' },
}

export function GranolaWorkspace() {
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [actions, setActions] = useState<ActionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TranscriptRow['status']>('needs_review')
  const [busy, setBusy] = useState<string | null>(null)
  const [linkTarget, setLinkTarget] = useState<TranscriptRow | null>(null)
  const [linkProjectId, setLinkProjectId] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [statusRes, transcriptsRes, actionsRes] = await Promise.all([
        fetch('/api/integrations/granola/status'),
        fetch('/api/integrations/granola/transcripts'),
        fetch('/api/integrations/granola/actions'),
      ])
      const [statusJson, transcriptsJson, actionsJson] = await Promise.all([
        statusRes.json(),
        transcriptsRes.json(),
        actionsRes.json(),
      ])

      if (!statusJson.success) throw new Error(statusJson.error ?? 'État Granola indisponible')
      setStatus(statusJson.data)
      setTranscripts(transcriptsJson.data?.transcripts ?? [])
      setProjects(transcriptsJson.data?.projects ?? [])
      setActions(actionsJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.status === tab),
    [transcripts, tab],
  )

  const pendingActions = useMemo(() => actions.filter((action) => action.status === 'proposed'), [actions])

  async function call(key: string, run: () => Promise<void>) {
    setBusy(key)
    try {
      await run()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Opération impossible')
    } finally {
      setBusy(null)
    }
  }

  const runSync = () =>
    call('sync', async () => {
      const res = await fetch('/api/integrations/granola/sync', { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? json.data?.skipped_reason ?? 'Synchronisation impossible')
      const ingest = json.data?.ingest
      toast.success(
        ingest
          ? `${ingest.fetched} réunion(s) : ${ingest.created} créée(s), ${ingest.updated} mise(s) à jour, ${ingest.needs_review} à arbitrer`
          : 'Synchronisation terminée',
      )
      await load()
    })

  const patchSettings = (patch: Record<string, unknown>, label: string) =>
    call(label, async () => {
      const res = await fetch('/api/integrations/granola/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Mise à jour impossible')
      await load()
    })

  const confirmLink = () =>
    call('link', async () => {
      if (!linkTarget || !linkProjectId) return
      const res = await fetch(`/api/integrations/granola/transcripts/${linkTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: linkProjectId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Rattachement impossible')
      toast.success('Compte rendu rattaché')
      setLinkTarget(null)
      setLinkProjectId('')
      await load()
    })

  const ignoreTranscript = (transcript: TranscriptRow) =>
    call(`ignore:${transcript.id}`, async () => {
      const res = await fetch(`/api/integrations/granola/transcripts/${transcript.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ignored' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Opération impossible')
      await load()
    })

  const extract = (transcript: TranscriptRow) =>
    call(`extract:${transcript.id}`, async () => {
      const res = await fetch(`/api/integrations/granola/transcripts/${transcript.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: Boolean(transcript.extracted_at) }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Extraction impossible')
      toast.success(`${json.data.queued} action(s) proposée(s)`)
      await load()
    })

  const decideAction = (action: ActionRow, decision: 'execute' | 'reject') =>
    call(`action:${action.id}`, async () => {
      const res = await fetch('/api/integrations/granola/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, decision }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? json.data?.detail ?? 'Action impossible')
      toast.success(decision === 'reject' ? 'Action rejetée' : 'Action exécutée')
      await load()
    })

  if (loading) {
    return (
      <PageLayout width="wide">
        <PageHeader eyebrow="Intégrations" title="Comptes rendus Granola" />
        <LoadingState variant="table" rows={6} />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout width="wide">
        <PageHeader eyebrow="Intégrations" title="Comptes rendus Granola" />
        <ErrorState title="Granola indisponible" description={error} onRetry={() => void load()} />
      </PageLayout>
    )
  }

  const settings = status?.settings
  const freshness = status?.freshness

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Intégrations"
        title="Comptes rendus Granola"
        description="Les rendez-vous enregistrés dans Granola, leur rattachement aux affaires et les actions que l'IA en a tirées."
        actions={
          <Button onClick={runSync} disabled={busy === 'sync'}>
            {busy === 'sync' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Synchroniser
          </Button>
        }
      />

      <Grid cols={4}>
        <MetricCard
          label="À arbitrer"
          value={String(status?.transcripts.needs_review ?? 0)}
          detail="Rendez-vous sans affaire reconnue"
          icon={Inbox}
          tone={(status?.transcripts.needs_review ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="Rattachés"
          value={String(status?.transcripts.classified ?? 0)}
          detail="Comptes rendus reliés à une affaire"
          icon={Link2}
          tone="success"
        />
        <MetricCard
          label="Actions en attente"
          value={String(pendingActions.length)}
          detail="Propositions issues de l'extraction"
          icon={Sparkles}
          tone={pendingActions.length > 0 ? 'brand' : 'neutral'}
        />
        <MetricCard
          label="Dernière synchro"
          value={freshness?.days_since_sync === null || freshness?.days_since_sync === undefined
            ? 'jamais'
            : `il y a ${freshness.days_since_sync} j`}
          detail={
            freshness?.stale
              ? 'Fenêtre de 30 jours en jeu : les réunions non ingérées seront perdues.'
              : 'Fenêtre de 30 jours sous contrôle.'
          }
          icon={freshness?.stale ? AlertTriangle : CheckCircle2}
          tone={freshness?.lost_window ? 'danger' : freshness?.stale ? 'warning' : 'success'}
        />
      </Grid>

      <Panel
        title="Connexion et bascules"
        description={
          status?.connection?.last_error
            ? `Dernière erreur : ${status.connection.last_error}`
            : 'Le plan gratuit expose 30 jours d’historique : la synchronisation quotidienne est ce qui empêche la perte définitive.'
        }
        actions={
          <Button variant="outline" asChild>
            <a href="/api/integrations/granola/oauth/start">
              {status?.connected ? 'Reconnecter Granola' : 'Connecter Granola'}
            </a>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={status?.connected ? 'success' : 'danger'}>
            {status?.connected ? `Connecté${status.connection?.account_email ? ` · ${status.connection.account_email}` : ''}` : 'Non connecté'}
          </StatusPill>
          <ToggleChip
            selected={Boolean(settings?.sync_enabled)}
            onClick={() => patchSettings({ sync_enabled: !settings?.sync_enabled }, 'sync_enabled')}
          >
            Synchronisation quotidienne
          </ToggleChip>
          <ToggleChip
            selected={Boolean(settings?.autodispatch_enabled)}
            onClick={() => patchSettings({ autodispatch_enabled: !settings?.autodispatch_enabled }, 'autodispatch')}
          >
            Exécution automatique des actions à risque faible
          </ToggleChip>
          <ToggleChip
            selected={Boolean(settings?.autodispatch_medium_enabled)}
            onClick={() =>
              patchSettings({ autodispatch_medium_enabled: !settings?.autodispatch_medium_enabled }, 'autodispatch_medium')
            }
          >
            Y compris le risque moyen
          </ToggleChip>
          <StatusPill tone="neutral">Seuil de rattachement : {settings?.match_threshold ?? '—'}</StatusPill>
        </div>
        {freshness?.message ? (
          <p className="text-sm text-muted-foreground">{freshness.message}</p>
        ) : null}
      </Panel>

      <DataToolbar
        title="Comptes rendus"
        description={`${visibleTranscripts.length} rendez-vous`}
        filters={
          <Tabs value={tab} onValueChange={(value) => setTab(value as TranscriptRow['status'])}>
            <TabsList>
              <TabsTrigger value="needs_review">À arbitrer</TabsTrigger>
              <TabsTrigger value="classified">Rattachés</TabsTrigger>
              <TabsTrigger value="ignored">Ignorés</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {visibleTranscripts.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="Aucun compte rendu"
          description="Lancez une synchronisation pour importer les rendez-vous enregistrés dans Granola."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rendez-vous</TableHead>
              <TableHead>Affaire</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTranscripts.map((transcript) => (
              <TableRow key={transcript.id}>
                <TableCell>
                  <span className="font-bold">{transcript.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {transcript.meeting_at ? new Date(transcript.meeting_at).toLocaleString('fr-FR') : 'date inconnue'}
                  </span>
                </TableCell>
                <TableCell>
                  {transcript.link ? (
                    <>
                      <span>{transcript.link.project_title ?? transcript.link.opportunity_id}</span>
                      <span className="block text-sm text-muted-foreground">
                        {(transcript.link.match_reasons ?? []).join(' · ') || 'Rattachement confirmé'}
                      </span>
                    </>
                  ) : transcript.suggestion ? (
                    <>
                      <span className="text-muted-foreground">
                        Suggestion : {transcript.suggestion.project_title ?? transcript.suggestion.opportunity_id}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {transcript.suggestion.reasons.join(' · ')}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucune affaire reconnue</span>
                  )}
                </TableCell>
                <TableCell>
                  {transcript.classification_confidence === null
                    ? '—'
                    : transcript.classification_confidence.toFixed(2)}
                </TableCell>
                <TableCell>
                  <StatusPill tone={STATUS_META[transcript.status].tone}>
                    {STATUS_META[transcript.status].label}
                  </StatusPill>
                  {transcript.extracted_at ? (
                    <span className="block text-sm text-muted-foreground">Extrait</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLinkTarget(transcript)
                        setLinkProjectId(
                          transcript.link?.opportunity_id ?? transcript.suggestion?.opportunity_id ?? '',
                        )
                      }}
                    >
                      Rattacher
                    </Button>
                    {transcript.status === 'classified' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => extract(transcript)}
                        disabled={busy === `extract:${transcript.id}`}
                      >
                        {busy === `extract:${transcript.id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        {transcript.extracted_at ? 'Rejouer' : 'Extraire'}
                      </Button>
                    ) : null}
                    {transcript.status !== 'ignored' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ignoreTranscript(transcript)}
                        disabled={busy === `ignore:${transcript.id}`}
                      >
                        Ignorer
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DataToolbar
        title="Actions proposées par l'IA"
        description="Une action à risque élevé n'est jamais exécutée seule : l'app n'envoie ni e-mail ni publication à votre place, la valider revient à acquitter ce que vous avez fait vous-même."
      />

      {actions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Aucune action proposée"
          description="Lancez une extraction sur un compte rendu rattaché pour voir apparaître des propositions."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Risque</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Décision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => (
              <TableRow key={action.id}>
                <TableCell>
                  <span className="font-bold">{action.title}</span>
                  {action.description ? (
                    <span className="block text-sm text-muted-foreground">{action.description}</span>
                  ) : null}
                  {action.error ? (
                    <span className="block text-sm text-destructive">{action.error}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{action.action_type}</TableCell>
                <TableCell>
                  <StatusPill tone={RISK_META[action.risk_level].tone}>{RISK_META[action.risk_level].label}</StatusPill>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{action.status}</TableCell>
                <TableCell>
                  {action.status === 'proposed' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => decideAction(action, 'execute')}
                        disabled={busy === `action:${action.id}`}
                      >
                        {busy === `action:${action.id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {action.risk_level === 'high' ? 'Marquer comme fait' : 'Exécuter'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => decideAction(action, 'reject')}
                        disabled={busy === `action:${action.id}`}
                      >
                        <XCircle className="size-4" />
                        Rejeter
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {action.executed_at ? new Date(action.executed_at).toLocaleString('fr-FR') : '—'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={linkTarget !== null} onOpenChange={(open) => (open ? null : setLinkTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rattacher le compte rendu</DialogTitle>
            <DialogDescription>{linkTarget?.title}</DialogDescription>
          </DialogHeader>
          <Select value={linkProjectId} onValueChange={setLinkProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une affaire" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {[project.reference, project.title ?? project.property_city].filter(Boolean).join(' — ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ActionBar>
            <Button variant="ghost" onClick={() => setLinkTarget(null)}>
              Annuler
            </Button>
            <Button onClick={confirmLink} disabled={!linkProjectId || busy === 'link'}>
              {busy === 'link' ? <Loader2 className="size-4 animate-spin" /> : null}
              Rattacher
            </Button>
          </ActionBar>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
