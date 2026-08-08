import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GET, POST, PATCH, DELETE } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabaseAdmin: {
      from: mockFrom,
    },
  }
})

import { supabaseAdmin } from '@/lib/supabase'

describe('/api/market/buyers/[id]/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET returns buyer documents list', async () => {
    const mockDossiersQuery = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'dossier-1' } }),
    }

    const mockDocsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'doc-1', label: 'CNI', status: 'requested', category: 'Identité' }],
        error: null,
      }),
    }

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'client_dossiers') return mockDossiersQuery as any
      if (table === 'client_documents') return mockDocsQuery as any
      return {} as any
    })

    const req = new NextRequest('http://localhost/api/market/buyers/buyer-1/documents')
    const res = await GET(req, { params: Promise.resolve({ id: 'buyer-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.documents).toHaveLength(1)
    expect(json.documents[0].label).toBe('CNI')
  })

  it('POST inserts a requested document', async () => {
    const mockDossiersQuery = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'dossier-1' } }),
    }

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockDocsQuery = {
      insert: mockInsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'doc-1', label: 'Justificatif domicile', status: 'requested' }],
        error: null,
      }),
    }

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'client_dossiers') return mockDossiersQuery as any
      if (table === 'client_documents') return mockDocsQuery as any
      return {} as any
    })

    const req = new NextRequest('http://localhost/api/market/buyers/buyer-1/documents', {
      method: 'POST',
      body: JSON.stringify({ label: 'Justificatif domicile', category: 'Identité' }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'buyer-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockInsert).toHaveBeenCalledWith({
      dossier_id: 'dossier-1',
      label: 'Justificatif domicile',
      category: 'Identité',
      status: 'requested',
      storage_path: null,
      file_name: null,
      mime_type: null,
      file_size: null,
      uploaded_at: null,
    })
  })
})
