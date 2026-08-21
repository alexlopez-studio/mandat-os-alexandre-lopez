'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Layers,
  Lightbulb,
  PenLine,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  ContentCalendar,
  DataToolbar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PageLayout,
  PageSection,
  Panel,
  SearchInput,
  StatusPill,
  endOfMonth,
  startOfMonth,
  type CalendarEntry,
} from '@/components/pro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_META,
  CONTENT_POST_STATUSES,
  CONTENT_POST_STATUS_META,
  CONTENT_ANGLE_STATUS_META,
  type ContentAngleWithPosts,
  type ContentChannel,
  type ContentPostStatus,
  type ContentPostWithAngle,
} from '@/lib/content-types'
import { NEWS_CATEGORY_META } from '@/lib/news-types'

type EditorialTab = 'calendar' | 'todo' | 'angles' | 'published'

const ALL = 'all'

const TABS: { value: EditorialTab; label: string; icon: typeof CalendarDays }[] = [
  { value: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { value: 'todo', label: 'À produire', icon: PenLine },
  { value: 'angles', label: 'Angles', icon: Lightbulb },
  { value: 'published', label: 'Publiés', icon: Check },
]

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EditorialWorkspace() {
  const [tab, setTab] = useState<EditorialTab>('calendar')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [posts, setPosts] = useState<ContentPostWithAngle[]>([])
  const [angles, setAngles] = useState<ContentAngleWithPosts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState<ContentChannel | typeof ALL>(ALL)
  const [status, setStatus] = useState<ContentPostStatus | typeof ALL>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(
    async (
      currentTab: EditorialTab,
      currentMonth: Date,
      query: string,
      currentChannel: string,
      currentStatus: string,
    ) => {
      try {
        setLoading(true)
        setError(false)

        if (currentTab === 'angles') {
          const params = new URLSearchParams({ limit: '100' })
          if (query) params.set('q', query)
          const res = await fetch(`/api/market/content/angles?${params.toString()}`)
          if (!res.ok) throw new Error('Failed to fetch angles')
          const json = await res.json()
          setAngles(json.items ?? [])
          return
        }

        const params = new URLSearchParams({ limit: '500' })
        if (query) params.set('q', query)
        if (currentChannel !== ALL) params.set('channel', currentChannel)

        if (currentTab === 'calendar') {
          params.set('from', startOfMonth(currentMonth).toISOString())
          params.set('to', endOfMonth(currentMonth).toISOString())
          if (currentStatus !== ALL) params.set('status', currentStatus)
        } else if (currentTab === 'todo') {
          params.set('unscheduled', '1')
        } else {
          params.set('status', 'published')
        }

        const res = await fetch(`/api/market/content/posts?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch posts')
        const json = await res.json()
        setPosts(json.items ?? [])
      } catch (err) {
        console.error(err)
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      load(tab, month, search, channel, status)
    }, 300)
    return () => clearTimeout(timer)
  }, [tab, month, search, channel, status, load])

  const reload = () => load(tab, month, search, channel, status)

  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? null,
    [posts, selectedId],
  )

  const entries: CalendarEntry[] = useMemo(
    () =>
      posts
        .filter((post) => post.scheduled_for)
        .map((post) => ({
          id: post.id,
          date: post.scheduled_for as string,
          label: post.title ?? post.content_angles?.title ?? 'Sans titre',
          channelLabel: CONTENT_CHANNEL_META[post.channel].label,
          tone: CONTENT_CHANNEL_META[post.channel].tone,
          muted: post.status === 'published' || post.status === 'cancelled',
        })),
    [posts],
  )

  async function patchPost(id: string, patch: Record<string, unknown>, message: string) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/market/content/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success(message)
      await reload()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSavingId(null)
    }
  }

  async function copyBody(post: ContentPostWithAngle) {
    const parts = [post.hook, post.body, post.cta].filter(Boolean)
    const hashtags = post.hashtags.length > 0 ? post.hashtags.join(' ') : null
    const payload = [...parts, hashtags].filter(Boolean).join('\n\n')
    if (!payload) {
      toast.error('Ce post n’a pas encore de texte')
      return
    }
    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Texte copié')
    } catch {
      toast.error('Copie impossible')
    }
  }

  const showCalendar = tab === 'calendar'
  const showAngles = tab === 'angles'
  const isEmpty = showAngles ? angles.length === 0 : posts.length === 0

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Éditorial"
        title="Calendrier éditorial"
        description="Chaque publication part d'un article de veille : un angle, puis ses déclinaisons blog, réseaux et newsletter."
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        }
      />

      <PageSection>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as EditorialTab)
            setSelectedId(null)
          }}
          className="flex flex-col gap-6"
        >
          <TabsList variant="pill" className="inline-flex w-full justify-start lg:w-auto">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="px-4 text-sm font-bold">
                <Icon className="mr-2 size-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <DataToolbar
            variant="pill"
            filters={
              <>
                <div className="mr-auto w-full sm:w-auto">
                  <SearchInput
                    label="Rechercher une publication"
                    placeholder={showAngles ? 'Titre de l’angle…' : 'Titre du post…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-full border-none bg-secondary/50"
                  />
                </div>

                {showAngles ? null : (
                  <Select value={channel} onValueChange={(v) => setChannel(v as ContentChannel | typeof ALL)}>
                    <SelectTrigger
                      className="h-9 w-44 rounded-full border-none bg-secondary/50 text-xs font-semibold"
                      aria-label="Filtrer par canal"
                    >
                      <SelectValue placeholder="Tous les canaux" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-xs font-medium">Tous les canaux</SelectItem>
                      {CONTENT_CHANNELS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs font-medium">
                          {CONTENT_CHANNEL_META[c].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {showCalendar ? (
                  <Select value={status} onValueChange={(v) => setStatus(v as ContentPostStatus | typeof ALL)}>
                    <SelectTrigger
                      className="h-9 w-44 rounded-full border-none bg-secondary/50 text-xs font-semibold"
                      aria-label="Filtrer par statut"
                    >
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL} className="text-xs font-medium">Tous les statuts</SelectItem>
                      {CONTENT_POST_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs font-medium">
                          {CONTENT_POST_STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </>
            }
          />

          {loading ? (
            <LoadingState variant="table" rows={6} />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : isEmpty ? (
            <EmptyState
              icon={showAngles ? Lightbulb : CalendarDays}
              title={showAngles ? 'Aucun angle éditorial' : 'Rien de planifié dans cette vue'}
              description="Les angles naissent de la veille : ouvrez un article et créez-en un, ou laissez Claude alimenter le calendrier."
            />
          ) : showCalendar ? (
            <ContentCalendar
              entries={entries}
              month={month}
              onMonthChange={setMonth}
              onSelectEntry={(entry) => setSelectedId(entry.id)}
            />
          ) : showAngles ? (
            <AnglesTable angles={angles} />
          ) : (
            <PostsTable
              posts={posts}
              savingId={savingId}
              onSelect={setSelectedId}
              onPublish={(post) => patchPost(post.id, { status: 'published' }, 'Marqué comme publié')}
            />
          )}

          {selected ? (
            <PostDetail
              post={selected}
              saving={savingId === selected.id}
              onCopy={() => copyBody(selected)}
              onClose={() => setSelectedId(null)}
              onPublish={() => patchPost(selected.id, { status: 'published' }, 'Marqué comme publié')}
              onSaveUrl={(url) => patchPost(selected.id, { external_url: url }, 'Lien enregistré')}
              onReschedule={(value) =>
                patchPost(
                  selected.id,
                  { scheduled_for: value ? new Date(value).toISOString() : null },
                  value ? 'Replanifié' : 'Sorti du calendrier',
                )
              }
            />
          ) : null}
        </Tabs>
      </PageSection>
    </PageLayout>
  )
}

function PostsTable({
  posts,
  savingId,
  onSelect,
  onPublish,
}: {
  posts: ContentPostWithAngle[]
  savingId: string | null
  onSelect: (id: string) => void
  onPublish: (post: ContentPostWithAngle) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Publication</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Planifié</TableHead>
          <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => {
          const source = post.content_angles?.news_items
          return (
            <TableRow key={post.id}>
              <TableCell className="whitespace-normal">
                <button
                  type="button"
                  onClick={() => onSelect(post.id)}
                  className="block text-left font-medium hover:underline"
                >
                  {post.title ?? post.content_angles?.title ?? 'Sans titre'}
                </button>
                <p className="text-xs text-muted-foreground">
                  {post.content_angles?.title ?? 'Angle supprimé'}
                  {source ? ' · depuis la veille' : ''}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{CONTENT_CHANNEL_META[post.channel].label}</Badge>
              </TableCell>
              <TableCell>
                <StatusPill tone={CONTENT_POST_STATUS_META[post.status].tone}>
                  {CONTENT_POST_STATUS_META[post.status].label}
                </StatusPill>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(post.scheduled_for)}</TableCell>
              <TableCell>
                {post.status === 'published' ? null : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Marquer comme publié"
                    disabled={savingId === post.id}
                    onClick={() => onPublish(post)}
                  >
                    <Send className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function AnglesTable({ angles }: { angles: ContentAngleWithPosts[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Angle</TableHead>
          <TableHead>Pilier</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Déclinaisons</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {angles.map((angle) => (
          <TableRow key={angle.id}>
            <TableCell className="whitespace-normal">
              <span className="block font-medium">{angle.title}</span>
              {angle.angle ? (
                <p className="text-xs text-muted-foreground">{angle.angle}</p>
              ) : null}
            </TableCell>
            <TableCell>
              {angle.pillar ? (
                <Badge variant="outline">{NEWS_CATEGORY_META[angle.pillar].label}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <StatusPill tone={CONTENT_ANGLE_STATUS_META[angle.status].tone}>
                {CONTENT_ANGLE_STATUS_META[angle.status].label}
              </StatusPill>
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-2">
                {angle.content_posts.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  angle.content_posts.map((post) => (
                    <StatusPill key={post.id} tone={CONTENT_CHANNEL_META[post.channel].tone}>
                      {CONTENT_CHANNEL_META[post.channel].short}
                    </StatusPill>
                  ))
                )}
              </span>
            </TableCell>
            <TableCell>
              {angle.news_items ? (
                <a
                  href={angle.news_items.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium hover:underline"
                >
                  <Layers className="size-4" />
                  {angle.news_items.source}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PostDetail({
  post,
  saving,
  onCopy,
  onClose,
  onPublish,
  onSaveUrl,
  onReschedule,
}: {
  post: ContentPostWithAngle
  saving: boolean
  onCopy: () => void
  onClose: () => void
  onPublish: () => void
  onSaveUrl: (url: string) => void
  onReschedule: (value: string) => void
}) {
  const [url, setUrl] = useState(post.external_url ?? '')
  const [scheduled, setScheduled] = useState(formatDateTimeLocal(post.scheduled_for))
  const source = post.content_angles?.news_items

  useEffect(() => {
    setUrl(post.external_url ?? '')
    setScheduled(formatDateTimeLocal(post.scheduled_for))
  }, [post.id, post.external_url, post.scheduled_for])

  return (
    <Panel
      title={post.title ?? post.content_angles?.title ?? 'Sans titre'}
      description={`${CONTENT_CHANNEL_META[post.channel].label} · ${CONTENT_POST_STATUS_META[post.status].label}`}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-2 size-4" />
            Copier le texte
          </Button>
          {post.status === 'published' ? null : (
            <Button size="sm" onClick={onPublish} disabled={saving}>
              <Send className="mr-2 size-4" />
              Marquer comme publié
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </span>
      }
    >
      {source ? (
        <p className="text-xs text-muted-foreground">
          Depuis la veille :{' '}
          <a href={source.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
            {source.title}
            <ExternalLink className="ml-2 inline size-4" />
          </a>
        </p>
      ) : null}

      {post.hook ? <p className="text-sm font-semibold text-foreground">{post.hook}</p> : null}

      {post.body ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{post.body}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pas encore de texte — c’est la skill « calendrier-editorial » qui le rédige.
        </p>
      )}

      {post.cta ? <p className="text-sm font-medium text-foreground">{post.cta}</p> : null}

      {post.hashtags.length > 0 ? (
        <p className="text-xs text-muted-foreground">{post.hashtags.join(' ')}</p>
      ) : null}

      {post.visual_brief ? (
        <p className="text-xs text-muted-foreground">Visuel : {post.visual_brief}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          aria-label="Date de publication planifiée"
          className="h-9 sm:w-64"
        />
        <Button variant="outline" size="sm" onClick={() => onReschedule(scheduled)} disabled={saving}>
          Replanifier
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL du post publié"
          aria-label="URL du post publié"
          className="h-9 sm:w-96"
        />
        <Button variant="outline" size="sm" onClick={() => onSaveUrl(url)} disabled={saving}>
          Enregistrer le lien
        </Button>
      </div>
    </Panel>
  )
}
