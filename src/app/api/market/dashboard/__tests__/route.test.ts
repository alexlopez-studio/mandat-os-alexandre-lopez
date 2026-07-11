import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tableData: new Map<string, unknown[]>(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.is = vi.fn(() => chain)
      chain.in = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => Promise.resolve({ data: mocks.tableData.get(table) ?? [], error: null }))
      return chain
    }),
  },
}))

import { GET } from '../route'

describe('GET /api/market/dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z'))
    mocks.tableData = new Map<string, unknown[]>([
      [
        'opportunities',
        [
          {
            id: 'opp-1',
            title: 'Vendeur Cotignac',
            stage: 'Nouveau contact',
            priority: 'haute',
            next_action: 'Appeler le vendeur',
            due_date: '2026-07-04',
            follow_up_at: null,
            created_at: '2026-07-01T10:00:00.000Z',
            updated_at: '2026-07-01T10:00:00.000Z',
          },
        ],
      ],
      [
        'buyer_criteria',
        [
          {
            id: 'buyer-row-1',
            lead_id: 'buyer-1',
            type_bien: 'Maison',
            communes: ['Cotignac'],
            budget_max: 450000,
            surface_min: null,
            pieces_min: null,
            active: true,
            stage: 'Nouveau contact',
            next_action: 'Qualifier la recherche',
            due_date: '2026-07-05',
            matched_at: null,
            created_at: '2026-07-02T10:00:00.000Z',
            updated_at: '2026-07-02T10:00:00.000Z',
          },
        ],
      ],
      [
        'opportunity_events',
        [
          {
            id: 'event-1',
            opportunity_id: 'opp-1',
            type: 'task',
            title: 'Préparer avis de valeur',
            content: null,
            due_at: '2026-07-06',
            completed_at: null,
            created_at: '2026-07-03T10:00:00.000Z',
          },
        ],
      ],
      [
        'client_dossiers',
        [
          {
            id: 'client-1',
            title: 'Dossier vendeur signé',
            client_type: 'seller',
            status: 'active',
            created_at: '2026-07-01T10:00:00.000Z',
            updated_at: '2026-07-01T10:00:00.000Z',
          },
        ],
      ],
      [
        'client_dossier_events',
        [
          {
            id: 'client-event-1',
            dossier_id: 'client-1',
            type: 'milestone',
            title: 'Valider photos',
            description: null,
            status: 'todo',
            event_date: '2026-07-05',
            created_at: '2026-07-03T10:00:00.000Z',
          },
        ],
      ],
      [
        'leads',
        [
          {
            id: 'lead-1',
            tool: 'estimation',
            status: 'nouveau',
            priority: 'normal',
            next_action: 'Compléter le contact',
            due_date: null,
            follow_up_at: null,
            commune: 'Lorgues',
            created_at: '2026-07-01T10:00:00.000Z',
          },
        ],
      ],
      [
        'warm_contacts',
        [
          {
            id: 'warm-1',
            full_name: 'Anne Partenaire',
            relation: 'Notaire',
            status: 'relance',
            follow_up_date: '2026-07-05',
            created_at: '2026-07-01T10:00:00.000Z',
            last_contacted_at: null,
          },
        ],
      ],
      [
        'market_properties',
        [
          {
            id: 'property-1',
            title: 'Maison chaude',
            city: 'Cotignac',
            mandate_phase: 'hot',
            status: 'active',
            created_at: '2026-07-01T10:00:00.000Z',
          },
        ],
      ],
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('aggregates action-oriented dashboard data from existing sources', async () => {
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.kpis.actions_due).toBe(4)
    expect(json.kpis.opportunities_active).toBe(2)
    expect(json.kpis.hot_properties).toBe(1)
    expect(json.actions.map((action: { source: string }) => action.source)).toContain('client_event')
    expect(json.actions[0].bucket).toBe('overdue')
    expect(json.quality.actions_without_due_date).toBe(1)
    expect(json.pipeline.sellers).toEqual([{ name: 'Nouveau contact', value: 1 }])
  })
})
