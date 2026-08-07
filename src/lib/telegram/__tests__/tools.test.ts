import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  similarTask: null as null | { id: string; content: string; dueDate: string | null },
  added: [] as unknown[],
  updated: [] as unknown[],
}))

vi.mock('@/lib/telegram/crm', () => ({
  getDossier: vi.fn(async () => ({
    id: 'opp-1', kind: 'vendeur', name: 'Monsieur Miche', city: 'Brignoles',
    stage: 'Pré-estimation', leadId: null,
  })),
  findSimilarOpenTask: vi.fn(async () => mocks.similarTask),
  addNoteOrTask: vi.fn(async (input: unknown) => {
    mocks.added.push(input)
    return { ref: 10, summary: 'Tâche — Monsieur Miche' }
  }),
  updateTask: vi.fn(async (input: unknown) => {
    mocks.updated.push(input)
    return { ref: 11, summary: 'Tâche mise à jour — Monsieur Miche : échéance lundi 10 août 2026' }
  }),
  createSeller: vi.fn(),
  createBuyer: vi.fn(),
  readDossierDetail: vi.fn(),
  searchDossiers: vi.fn(),
  dossierLabel: (d: { name: string }) => d.name,
}))

import { executeTool, TOOL_DEFINITIONS } from '@/lib/telegram/tools'

const ctx = { chatId: 1, sourceText: 'peu importe' }

function callTool(name: string, args: Record<string, unknown>) {
  return executeTool(name, JSON.stringify(args), ctx)
}

describe('outils Telegram', () => {
  beforeEach(() => {
    mocks.similarTask = null
    mocks.added = []
    mocks.updated = []
  })

  it('expose un outil de modification, sans lequel toute date crée un doublon', () => {
    expect(TOOL_DEFINITIONS.map((tool) => tool.name)).toContain('modifier_tache')
  })

  it('refuse une tâche en doublon et oriente vers modifier_tache', async () => {
    mocks.similarTask = { id: 'task-1', content: 'envoyer le rapport d’estimation', dueDate: null }

    const { result } = await callTool('ajouter_tache', {
      dossier_id: 'opp-1',
      contenu: 'envoi du rapport d’estimation',
      echeance: '2026-08-10',
    })
    const parsed = JSON.parse(result)

    expect(parsed.erreur).toContain('création refusée')
    expect(parsed.tache_existante.tache_id).toBe('task-1')
    expect(parsed.a_faire).toContain('modifier_tache')
    expect(mocks.added).toHaveLength(0)
  })

  it('crée la tâche quand aucune équivalente n’existe', async () => {
    const { result } = await callTool('ajouter_tache', {
      dossier_id: 'opp-1',
      contenu: 'appeler le notaire',
      echeance: '2026-08-10',
    })

    expect(JSON.parse(result).ok).toBe(true)
    expect(mocks.added).toHaveLength(1)
  })

  it('transmet l’échéance à modifier_tache sans rien créer', async () => {
    const { result } = await callTool('modifier_tache', {
      tache_id: 'task-1',
      echeance: 'lundi prochain',
    })

    expect(JSON.parse(result).ok).toBe(true)
    expect(mocks.updated).toEqual([
      expect.objectContaining({ taskId: 'task-1', dueDate: 'lundi prochain' }),
    ])
    expect(mocks.added).toHaveLength(0)
  })

  it('remonte l’erreur au modèle au lieu de la laisser filer', async () => {
    const { result } = await callTool('outil_inconnu', {})
    expect(JSON.parse(result).erreur).toContain('Outil inconnu')
  })
})
