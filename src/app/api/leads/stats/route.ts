import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/leads/stats — Statistiques agrégées des leads
 *
 * Retourne :
 *   - total        : nombre total de leads
 *   - nouveaux     : leads avec status 'nouveau'
 *   - contactes    : leads avec status != 'nouveau'
 *   - vendre       : leads outil 'vendre'
 *   - acheter      : leads outil 'acheter'
 *   - audit        : leads outil 'audit'
 *   - aujourdhui   : leads créés aujourd'hui
 *   - cetteSemaine : leads créés cette semaine
 *   - ceMois       : leads créés ce mois
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
    try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

        const weekStart = new Date(now)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)
        const weekStartISO = weekStart.toISOString()

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        // Requêtes parallèles pour les stats
        const [
            totalResult,
            nouveauxResult,
            vendreResult,
            acheterResult,
            auditResult,
            aujourdhuiResult,
            semaineResult,
            moisResult,
        ] = await Promise.all([
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).eq('status', 'nouveau'),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).eq('tool', 'vendre'),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).eq('tool', 'acheter'),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).eq('tool', 'audit'),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).gte('created_at', todayStart),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).gte('created_at', weekStartISO),
            supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_test', false).gte('created_at', monthStart),
        ])

        const count = (r: typeof totalResult) => r.count ?? 0

        return NextResponse.json({
            success: true,
            data: {
                total: count(totalResult),
                nouveaux: count(nouveauxResult),
                contactes: count(totalResult) - count(nouveauxResult),
                vendre: count(vendreResult),
                acheter: count(acheterResult),
                audit: count(auditResult),
                aujourdhui: count(aujourdhuiResult),
                cetteSemaine: count(semaineResult),
                ceMois: count(moisResult),
            },
        })
    } catch (err) {
        console.error('[API GET /leads/stats]', err)
        return NextResponse.json(
            { success: false, error: 'Erreur lors du calcul des statistiques' },
            { status: 500 },
        )
    }
}