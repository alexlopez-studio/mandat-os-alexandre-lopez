import { NextRequest, NextResponse } from 'next/server'

import { adminDb } from '@/lib/ai/db'
import { isGranolaMachineOrAdmin } from '@/lib/integrations/granola/auth'
import { listProjectCandidates } from '@/lib/integrations/granola/matching'
import { GRANOLA_PROVIDER } from '@/lib/integrations/granola/types'

/**
 * GET /api/integrations/granola/transcripts — comptes rendus et leur rattachement.
 *
 * Sert le back-office d'arbitrage : un rendez-vous ambigu reste en
 * `needs_review` et doit apparaitre ici avec ses `match_reasons`, sans quoi il
 * disparait purement et simplement du flux de travail.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isGranolaMachineOrAdmin(req))) {
    return NextResponse.json({ success: false, error: 'Non authentifie' }, { status: 401 })
  }

  try {
    const status = req.nextUrl.searchParams.get('status')

    let query = adminDb()
      .from('external_transcripts')
      .select(
        'id, external_id, title, meeting_at, summary, status, classification_confidence, extracted_at, extraction_error, created_at, raw_payload',
      )
      .eq('provider', GRANOLA_PROVIDER)
      .order('meeting_at', { ascending: false, nullsFirst: false })
      .limit(100)

    if (status && ['classified', 'needs_review', 'ignored'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: transcripts, error } = await query
    if (error) throw new Error(error.message)

    const rows = transcripts ?? []
    const links = await listLinks(rows.map((row: { external_id: string }) => row.external_id))
    const projects = await listProjectCandidates()
    const projectById = new Map(projects.map((project) => [project.id, project]))

    return NextResponse.json({
      success: true,
      data: {
        transcripts: rows.map((row: Record<string, unknown>) => {
          const link = links.get(row.external_id as string)
          const project = link ? projectById.get(link.opportunity_id) : undefined

          // `raw_payload` porte la charge Granola complete : on n'en ressort que
          // la suggestion de rattachement, le reste n'a rien a faire dans l'UI.
          const rawPayload = (row.raw_payload ?? {}) as Record<string, unknown>
          const suggestion = rawPayload.match_suggestion as
            | { project_id: string; score: number; reasons: string[] }
            | null
            | undefined
          const suggestedProject = suggestion ? projectById.get(suggestion.project_id) : undefined
          const { raw_payload: _rawPayload, ...rest } = row

          return {
            ...rest,
            suggestion:
              suggestion && !link
                ? {
                    opportunity_id: suggestion.project_id,
                    score: suggestion.score,
                    reasons: suggestion.reasons ?? [],
                    project_title: suggestedProject?.title ?? null,
                    project_reference: suggestedProject?.reference ?? null,
                  }
                : null,
            link: link
              ? {
                  opportunity_id: link.opportunity_id,
                  match_score: link.match_score,
                  match_reasons: link.match_reasons ?? [],
                  confirmed_by: link.confirmed_by,
                  project_title: project?.title ?? null,
                  project_reference: project?.reference ?? null,
                }
              : null,
          }
        }),
        projects,
      },
    })
  } catch (err) {
    console.error('[GET /api/integrations/granola/transcripts]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lecture impossible' },
      { status: 500 },
    )
  }
}

async function listLinks(meetingIds: string[]) {
  if (meetingIds.length === 0) return new Map<string, any>()

  const { data, error } = await adminDb()
    .from('opportunity_meeting_links')
    .select('opportunity_id, meeting_id, match_score, match_reasons, confirmed_by, confirmed_at')
    .eq('source', GRANOLA_PROVIDER)
    .in('meeting_id', meetingIds)
    .order('confirmed_at', { ascending: false })

  if (error) throw new Error(error.message)

  const byMeeting = new Map<string, any>()
  for (const row of data ?? []) {
    if (!byMeeting.has(row.meeting_id)) byMeeting.set(row.meeting_id, row)
  }
  return byMeeting
}
