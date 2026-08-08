import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  similarTask: null as null | { id: string; content: string; dueDate: string | null },
  added: [] as unknown[],
  updated: [] as unknown[],
}))

vi.mock('@/lib/telegram/crm', () => ({
  getProject: vi.fn(async () => ({
    id: 'opp-1', kind: 'vente', title: 'Projet de vente', city: 'Brignoles',
    stage: 'Pré-estimation'
  })),
  findSimilarOpenTask: vi.fn(async () => mocks.similarTask),
  addNoteOrTask: vi.fn(async (input: unknown) => {
    mocks.added.push(input)
    return { ref: 10, summary: 'Tâche — Projet de vente' }
  }),
  updateTask: vi.fn(async (input: unknown) => {
    mocks.updated.push(input)
    return { ref: 11, summary: 'Tâche mise à jour — Projet de vente : échéance lundi 10 août 2026' }
  }),
  createProject: vi.fn(),
  readProjectDetail: vi.fn(),
  searchContacts: vi.fn(),
  searchProjects: vi.fn(),
  projetLabel: (p: { title: string }) => p.title,
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

  it('date la tâche existante au lieu d’en créer une seconde', async () => {
    mocks.similarTask = { id: 'task-1', content: 'envoyer le rapport d’estimation', dueDate: '2026-08-10' }

    const { result } = await callTool('ajouter_tache', {
      projet_id: 'opp-1',
      contenu: 'envoi du rapport d’estimation',
      echeance: '2026-08-11',
    })
    const parsed = JSON.parse(result)

    expect(parsed.ok).toBe(true)
    expect(parsed.mise_a_jour).toBe(true)
    expect(mocks.added).toHaveLength(0)
    expect(mocks.updated).toEqual([
      expect.objectContaining({ taskId: 'task-1', dueDate: '2026-08-11' }),
    ])
  })

  it('signale simplement le doublon quand aucune échéance n’est donnée', async () => {
    mocks.similarTask = { id: 'task-1', content: 'envoyer le rapport d’estimation', dueDate: null }

    const { result } = await callTool('ajouter_tache', {
      projet_id: 'opp-1',
      contenu: 'envoi du rapport d’estimation',
    })
    const parsed = JSON.parse(result)

    expect(parsed.deja_present).toBe(true)
    expect(parsed.tache_existante.tache_id).toBe('task-1')
    expect(mocks.added).toHaveLength(0)
    expect(mocks.updated).toHaveLength(0)
  })

  it('crée la tâche quand aucune équivalente n’existe', async () => {
    const { result } = await callTool('ajouter_tache', {
      projet_id: 'opp-1',
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
