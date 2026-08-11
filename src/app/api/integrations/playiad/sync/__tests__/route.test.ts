import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { normalizePhone, normalizeEmail, leadDedupKey } from '@/lib/playiad/leads'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { supabaseAdmin } from '@/lib/supabase'

const SECRET = 'test-secret'

function request(body: unknown, key: string | null = SECRET) {
  return new NextRequest('http://localhost/api/integrations/playiad/sync', {
    method: 'POST',
    headers: key ? { 'x-mandat-os-key': key } : {},
    body: JSON.stringify(body),
  })
}

/** Annuaire vide : tout lead valide donne lieu a une creation. */
function mockEmptyCrm() {
  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === 'contacts') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'contact-1' }, error: null }) }),
        }),
      } as never
    }
    if (table === 'projects') {
      return {
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'project-1' }, error: null }) }),
        }),
      } as never
    }
    if (table === 'project_contacts') {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
        insert: () => Promise.resolve({ error: null }),
      } as never
    }
    return {} as never
  })
}

describe('normalizePhone', () => {
  it('ramene les formats Playiad a une forme canonique', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('0612345678')
    expect(normalizePhone('06.12.34.56.78')).toBe('0612345678')
    expect(normalizePhone('0033612345678')).toBe('0612345678')
    expect(normalizePhone('06 12 34 56 78')).toBe('0612345678')
  })

  it('rejette ce qui n’est pas un numero exploitable', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('leadDedupKey', () => {
  it('prefere l’e-mail, puis le telephone', () => {
    expect(leadDedupKey({ email: 'a@b.fr', phone: '0612345678', playiadId: 'x' })).toBe('email:a@b.fr')
    expect(leadDedupKey({ email: null, phone: '0612345678', playiadId: 'x' })).toBe('phone:0612345678')
  })

  it('n’invente pas de cle quand le lead n’a aucune coordonnee', () => {
    expect(leadDedupKey({ email: null, phone: null, playiadId: null })).toBeNull()
  })

  it('normalise l’e-mail avant comparaison', () => {
    expect(normalizeEmail('Claire.Moreau@Example.COM')).toBe('claire.moreau@example.com')
  })
})

describe('POST /api/integrations/playiad/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PLAYIAD_SYNC_SECRET = SECRET
  })

  afterEach(() => {
    delete process.env.PLAYIAD_SYNC_SECRET
  })

  it('refuse une requête sans clé', async () => {
    const res = await POST(request({ leads: [] }, null))
    expect(res.status).toBe(401)
  })

  it('refuse une clé erronée', async () => {
    const res = await POST(request({ leads: [] }, 'mauvaise-clé'))
    expect(res.status).toBe(401)
  })

  it('reste fermé quand aucun secret n’est configuré', async () => {
    delete process.env.PLAYIAD_SYNC_SECRET
    const res = await POST(request({ leads: [] }))
    expect(res.status).toBe(401)
  })

  it('rejette une charge vide', async () => {
    const res = await POST(request({ leads: [] }))
    expect(res.status).toBe(400)
  })

  it('crée le contact et le projet acquéreur', async () => {
    mockEmptyCrm()

    const res = await POST(
      request({
        leads: [
          {
            first_name: 'Claire',
            last_name: 'Moreau',
            email: 'Claire.Moreau@example.com',
            phone: '+33 6 98 76 54 32',
            property_type: 'appartement',
            budget_max: 420000,
          },
        ],
      }),
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.createdCount).toBe(1)
    expect(json.results[0].status).toBe('created')
    expect(json.results[0].project_id).toBe('project-1')
  })

  it('ne crée qu’une fois un acquéreur présent deux fois dans la page', async () => {
    mockEmptyCrm()

    const lead = { first_name: 'Claire', last_name: 'Moreau', phone: '06 98 76 54 32' }
    const res = await POST(
      request({ leads: [lead, { ...lead, phone: '+33 6 98 76 54 32' }] }),
    )

    const json = await res.json()
    expect(json.createdCount).toBe(1)
    expect(json.skippedCount).toBe(1)
    expect(json.results[1].reason).toBe('Doublon dans la page')
  })

  it('reconnaît le même acquéreur listé une fois par e-mail, une fois par téléphone', async () => {
    mockEmptyCrm()

    const res = await POST(
      request({
        leads: [
          { first_name: 'Claire', email: 'claire@example.com', phone: '+33 6 98 76 54 32' },
          { first_name: 'Claire', phone: '06.98.76.54.32' },
        ],
      }),
    )

    const json = await res.json()
    expect(json.createdCount).toBe(1)
    expect(json.skippedCount).toBe(1)
  })

  it('ignore un lead sans e-mail ni téléphone', async () => {
    mockEmptyCrm()

    const res = await POST(request({ leads: [{ first_name: 'Sans', last_name: 'Coordonnées' }] }))

    const json = await res.json()
    expect(json.errorCount).toBe(1)
    expect(json.results[0].status).toBe('invalid_data')
  })

  it('n’écrit rien en mode simulation', async () => {
    mockEmptyCrm()

    const res = await POST(
      request({
        dryRun: true,
        leads: [{ first_name: 'Claire', last_name: 'Moreau', email: 'claire@example.com' }],
      }),
    )

    const json = await res.json()
    expect(json.dryRun).toBe(true)
    expect(json.createdCount).toBe(1)
    // Aucune insertion : seules les lectures de dedoublonnage ont eu lieu.
    const insertedTables = vi.mocked(supabaseAdmin.from).mock.calls.map(([table]) => table)
    expect(insertedTables).not.toContain('projects')
  })

  it('saute un acquéreur qui a déjà un projet d’achat ouvert', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'contact-1' } }) }),
          }),
        } as never
      }
      if (table === 'project_contacts') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ buyer_criteria_id: 'project-1', opportunity_id: null }] }),
          }),
        } as never
      }
      if (table === 'projects') {
        return {
          select: () => ({
            in: () => ({ eq: () => ({ neq: () => Promise.resolve({ data: [{ id: 'project-1' }] }) }) }),
          }),
        } as never
      }
      return {} as never
    })

    const res = await POST(request({ leads: [{ email: 'claire@example.com', first_name: 'Claire' }] }))

    const json = await res.json()
    expect(json.createdCount).toBe(0)
    expect(json.skippedCount).toBe(1)
    expect(json.results[0].reason).toBe('Projet acquéreur déjà ouvert')
  })
})
