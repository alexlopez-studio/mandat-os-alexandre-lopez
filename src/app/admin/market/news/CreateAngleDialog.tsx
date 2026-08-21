'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CONTENT_CHANNELS, CONTENT_CHANNEL_META, type ContentChannel } from '@/lib/content-types'
import { NEWS_CATEGORIES, NEWS_CATEGORY_META, type NewsItem } from '@/lib/news-types'

type CreateAngleDialogProps = {
  item: NewsItem | null
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

/**
 * Transforme un article de veille en angle editorial.
 *
 * C'est le seul endroit de l'app ou la chaine veille -> editorial se cree a la
 * main : le reste du temps, c'est la skill `calendrier-editorial` qui la pose.
 * On ne demande donc que le strict minimum, les declinaisons restent vides et
 * seront redigees ensuite.
 */
export function CreateAngleDialog({ item, onOpenChange, onCreated }: CreateAngleDialogProps) {
  const [title, setTitle] = useState('')
  const [angle, setAngle] = useState('')
  const [pillar, setPillar] = useState<string>('')
  const [channels, setChannels] = useState<ContentChannel[]>(['linkedin'])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setTitle(item.title)
    setAngle(item.summary ?? '')
    setPillar(item.category)
    setChannels(['linkedin'])
  }, [item])

  function toggleChannel(channel: ContentChannel) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    )
  }

  async function submit() {
    if (!item) return
    if (!title.trim()) {
      toast.error('Un titre est requis')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/market/content/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          news_item_id: item.id,
          title: title.trim(),
          angle: angle.trim() || null,
          pillar: pillar || null,
          city: item.city,
          insee_code: item.insee_code,
          status: 'idea',
          created_by: 'admin',
          posts: channels.map((channel) => ({
            channel,
            status: 'draft',
            title: title.trim(),
            created_by: 'admin',
          })),
        }),
      })
      if (!res.ok) throw new Error('Create failed')
      toast.success('Angle éditorial créé')
      onCreated()
      onOpenChange(false)
    } catch {
      toast.error('Création impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un angle éditorial</DialogTitle>
          <DialogDescription>
            L’article reste la source : l’angle et ses déclinaisons y resteront rattachés.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="angle-title">Titre</Label>
            <Input id="angle-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="angle-body">Angle</Label>
            <Textarea
              id="angle-body"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="Ce qu’on raconte, et pour qui."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="angle-pillar">Pilier</Label>
            <Select value={pillar} onValueChange={setPillar}>
              <SelectTrigger id="angle-pillar">
                <SelectValue placeholder="Choisir un pilier" />
              </SelectTrigger>
              <SelectContent>
                {NEWS_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {NEWS_CATEGORY_META[category].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Déclinaisons à préparer</Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_CHANNELS.map((channel) => (
                <Button
                  key={channel}
                  type="button"
                  size="sm"
                  variant={channels.includes(channel) ? 'default' : 'outline'}
                  onClick={() => toggleChannel(channel)}
                >
                  {CONTENT_CHANNEL_META[channel].label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            Créer l’angle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
