import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/ai/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const [{ data: thread, error: threadErr }, { data: messages, error: msgErr }] = await Promise.all([
      adminDb().from('ai_threads').select('*').eq('id', id).single(),
      adminDb().from('ai_messages').select('role, content, created_at').eq('thread_id', id).order('created_at', { ascending: true }),
    ])

    if (threadErr) throw new Error(threadErr.message)
    if (msgErr) throw new Error(msgErr.message)

    return NextResponse.json({
      success: true,
      data: {
        thread,
        messages: ((messages ?? []) as Array<{ role: string; content: string; created_at: string }>).map((m) => ({
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
      },
    })
  } catch (err) {
    console.error('[GET /api/ai/threads/[id]]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur chargement' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await adminDb().from('ai_messages').delete().eq('thread_id', id)
    const { error } = await adminDb().from('ai_threads').delete().eq('id', id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/ai/threads/[id]]', err)
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur suppression' }, { status: 500 })
  }
}
