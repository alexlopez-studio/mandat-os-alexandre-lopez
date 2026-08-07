import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  descending: null as boolean | null,
  limit: null as number | null,
}))

vi.mock('@/lib/ai/db', () => ({
  adminDb: () => ({
    from: () => {
      const chain: Record<string, any> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.order = (_column: string, options: { ascending: boolean }) => {
        mocks.descending = options.ascending === false
        return chain
      }
      chain.limit = (value: number) => {
        mocks.limit = value
        // La base rend les lignes dans l'ordre demandé, tronquées à `limit`.
        const ordered = mocks.descending ? [...mocks.rows].reverse() : mocks.rows
        return Promise.resolve({ data: ordered.slice(0, value), error: null })
      }
      return chain
    },
  }),
}))

import { loadHistory } from '@/lib/telegram/memory'

/** Fil long : 30 échanges anodins, puis la vraie demande en dernier. */
function longThread() {
  const rows: Array<Record<string, unknown>> = []
  for (let i = 0; i < 30; i += 1) {
    rows.push({ role: 'user', content: `ancien message ${i}`, metadata: {} })
    rows.push({ role: 'assistant', content: `ancienne réponse ${i}`, metadata: {} })
  }
  rows.push({ role: 'user', content: 'modifie la date au mardi 11 août 2026', metadata: {} })
  return rows
}

describe('loadHistory', () => {
  beforeEach(() => {
    mocks.rows = []
    mocks.descending = null
    mocks.limit = null
  })

  it('retient les messages les plus récents, pas le début du fil', async () => {
    mocks.rows = longThread()

    const history = await loadHistory('thread-1')
    const last = history[history.length - 1]

    // Le bug : trié à l'endroit, la fenêtre gardait « ancien message 0 » et
    // coupait la demande qu'Alexandre venait d'envoyer.
    expect(last).toEqual({ role: 'user', content: 'modifie la date au mardi 11 août 2026' })
    expect(history.some((m) => m.content === 'ancien message 0')).toBe(false)
  })

  it('ne commence jamais par un résultat d’outil orphelin', async () => {
    mocks.rows = [
      { role: 'tool', content: '{"ok":true}', metadata: { tool_call_id: 'call-1' } },
      { role: 'assistant', content: 'voilà', metadata: {} },
      { role: 'user', content: 'et ensuite ?', metadata: {} },
    ]

    const history = await loadHistory('thread-1')

    expect(history[0].role).toBe('user')
    expect(history.some((m) => m.role === 'tool')).toBe(false)
  })

  it('conserve les appels d’outils rattachés à leur message assistant', async () => {
    mocks.rows = [
      { role: 'user', content: 'ajoute une tâche', metadata: {} },
      {
        role: 'assistant',
        content: '',
        metadata: { tool_calls: [{ id: 'call-1', name: 'ajouter_tache', arguments: '{}' }] },
      },
      { role: 'tool', content: '{"ok":true}', metadata: { tool_call_id: 'call-1' } },
    ]

    const history = await loadHistory('thread-1')

    expect(history).toHaveLength(3)
    expect(history[1]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'call-1' }] })
    expect(history[2]).toMatchObject({ role: 'tool', tool_call_id: 'call-1' })
  })
})
