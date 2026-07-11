'use client'

import { useEffect, useState } from 'react'
import type { RadarListing } from '@/lib/mandat/types'
import { SellerPhaseBadge } from './SellerPhaseBadge'

interface FiltersState {
    zipcodes: string
    propertyTypes: string
    phases: string[]
    minScore: string
    maxScore: string
}

export function RadarTable({ filters }: { filters: FiltersState }) {
    const [listings, setListings] = useState<RadarListing[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)

        const params = new URLSearchParams()
        if (filters.zipcodes) params.set('zipcodes', filters.zipcodes)
        if (filters.propertyTypes) params.set('property_types', filters.propertyTypes)
        if (filters.phases.length > 0) params.set('phases', filters.phases.join(','))
        if (filters.minScore) params.set('min_score', filters.minScore)
        if (filters.maxScore) params.set('max_score', filters.maxScore)
        params.set('limit', '50')

        fetch(`/api/radar/listings?${params.toString()}`)
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setListings(json.data)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [filters])

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8">
                <div className="animate-pulse space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded" />
                    ))}
                </div>
            </div>
        )
    }

    if (listings.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                Aucune annonce trouvée
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ville</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Surface</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jours</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Phase</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {listings.map((listing) => (
                            <tr key={listing.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {listing.city ?? listing.zipcode}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {listing.property_type ?? '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                                    {listing.price
                                        ? `${listing.price.toLocaleString('fr-FR')} €`
                                        : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                    {listing.surface ? `${listing.surface} m²` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                    {listing.days_online}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span
                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${listing.score >= 70
                                                ? 'bg-red-100 text-red-700'
                                                : listing.score >= 55
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : listing.score >= 30
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        {listing.score}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <SellerPhaseBadge phase={listing.phase} />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {listing.price_drops_count > 0 && (
                                        <span className="text-red-600" title={`${listing.price_drops_count} baisse(s)`}>
                                            📉 {listing.price_drops_count}
                                        </span>
                                    )}
                                    {listing.is_relisted && (
                                        <span className="text-blue-600 ml-2" title="Republication">
                                            🔄
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}