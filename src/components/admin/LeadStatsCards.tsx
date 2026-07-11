'use client'

import { useEffect, useState } from 'react'
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

interface LeadStats {
    total: number
    nouveaux: number
    contactes: number
    vendre: number
    acheter: number
    audit: number
    aujourdhui: number
    cetteSemaine: number
    ceMois: number
}

export function LeadStatsCards() {
    const [stats, setStats] = useState<LeadStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/leads/stats')
                if (res.ok) {
                    const json = await res.json()
                    if (json.success) {
                        setStats(json.data)
                    }
                }
            } catch (err) {
                console.error('[LeadStatsCards] fetch error:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="@container/card">
                        <CardHeader className="relative">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        )
    }

    const s = stats ?? { total: 0, nouveaux: 0, contactes: 0, vendre: 0, acheter: 0, audit: 0, aujourdhui: 0, cetteSemaine: 0, ceMois: 0 }

    const cards = [
        {
            title: 'Nouveaux contacts',
            value: s.nouveaux,
            total: s.total,
            desc: 'En attente de contact',
            trend: s.aujourdhui > 0 ? 'up' as const : 'neutral' as const,
            trendText: s.aujourdhui + " aujourd'hui",
        },
        {
            title: 'Vente',
            value: s.vendre,
            total: s.total,
            desc: 'Demandes estimation',
            trend: s.vendre > s.acheter ? 'up' as const : 'neutral' as const,
            trendText: Math.round((s.vendre / Math.max(1, s.total)) * 100) + '% du total',
        },
        {
            title: 'Achat',
            value: s.acheter,
            total: s.total,
            desc: 'Projets acheteurs',
            trend: s.acheter > s.audit ? 'up' as const : 'neutral' as const,
            trendText: Math.round((s.acheter / Math.max(1, s.total)) * 100) + '% du total',
        },
        {
            title: 'Contactés',
            value: s.contactes,
            total: s.nouveaux + s.contactes || 1,
            desc: 'Taux de contact',
            trend: s.contactes > 0 ? 'up' as const : 'neutral' as const,
            trendText: Math.round((s.contactes / Math.max(1, s.nouveaux + s.contactes)) * 100) + '% de contact',
        },
    ]

    return (
        <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
            {cards.map((card) => (
                <Card key={card.title} className="@container/card">
                    <CardHeader className="relative">
                        <CardDescription>{card.title}</CardDescription>
                        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
                            {card.value}
                        </CardTitle>
                        <div className="absolute right-4 top-4">
                            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
                                {card.trend === 'up' ? <TrendingUpIcon className="size-3" /> : null}
                                {card.trendText}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            {card.desc}
                        </div>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}
