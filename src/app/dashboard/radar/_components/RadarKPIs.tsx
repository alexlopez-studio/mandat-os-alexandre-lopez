'use client'

import { useEffect, useState } from 'react'

interface KPIs {
    totalActive: number
    hotListings: number
    staleListings: number
    priceDropsThisWeek: number
    averageScore: number
}

export function RadarKPIs() {
    const [kpis, setKpis] = useState<KPIs | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/radar/listings?mode=kpis')
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setKpis(json.data)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                ))}
            </div>
        )
    }

    if (!kpis) return null

    const items = [
        { label: 'Annonces actives', value: kpis.totalActive, color: 'text-blue-600' },
        { label: '🔥 Fenêtre d\'or', value: kpis.hotListings, color: 'text-red-600' },
        { label: '⏳ Stagnantes 90j+', value: kpis.staleListings, color: 'text-yellow-600' },
        { label: '📉 Baisses cette semaine', value: kpis.priceDropsThisWeek, color: 'text-green-600' },
        { label: 'Score moyen', value: `${kpis.averageScore}/100`, color: 'text-purple-600' },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {items.map((item) => (
                <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                </div>
            ))}
        </div>
    )
}