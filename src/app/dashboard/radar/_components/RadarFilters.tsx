'use client'

import { useState } from 'react'
import type { SellerPhase } from '@/lib/mandat/types'

interface FiltersState {
    zipcodes: string
    propertyTypes: string
    phases: SellerPhase[]
    minScore: string
    maxScore: string
}

interface Props {
    onFiltersChange: (filters: FiltersState) => void
}

export function RadarFilters({ onFiltersChange }: Props) {
    const [filters, setFilters] = useState<FiltersState>({
        zipcodes: '',
        propertyTypes: '',
        phases: [],
        minScore: '',
        maxScore: '',
    })

    const phases: { value: SellerPhase; label: string }[] = [
        { value: 'cold', label: 'Froid' },
        { value: 'warm', label: 'Tiède' },
        { value: 'hot', label: 'Chaud' },
        { value: 'golden', label: 'Fenêtre d\'or' },
    ]

    function update(key: keyof FiltersState, value: string | SellerPhase[]) {
        const next = { ...filters, [key]: value }
        setFilters(next)
        onFiltersChange(next)
    }

    function togglePhase(phase: SellerPhase) {
        const has = filters.phases.includes(phase)
        update('phases', has ? filters.phases.filter((p) => p !== phase) : [...filters.phases, phase])
    }

    function reset() {
        const empty: FiltersState = {
            zipcodes: '',
            propertyTypes: '',
            phases: [],
            minScore: '',
            maxScore: '',
        }
        setFilters(empty)
        onFiltersChange(empty)
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Filtres</h3>
                <button
                    type="button"
                    onClick={reset}
                    className="text-xs text-blue-600 hover:text-blue-800"
                >
                    Réinitialiser
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Codes postaux</label>
                    <input
                        type="text"
                        value={filters.zipcodes}
                        onChange={(e) => update('zipcodes', e.target.value)}
                        placeholder="83600, 83220..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Types de bien</label>
                    <input
                        type="text"
                        value={filters.propertyTypes}
                        onChange={(e) => update('propertyTypes', e.target.value)}
                        placeholder="house, apartment..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Score min</label>
                    <input
                        type="number"
                        value={filters.minScore}
                        onChange={(e) => update('minScore', e.target.value)}
                        placeholder="0"
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Score max</label>
                    <input
                        type="number"
                        value={filters.maxScore}
                        onChange={(e) => update('maxScore', e.target.value)}
                        placeholder="100"
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {phases.map((phase) => (
                    <button
                        key={phase.value}
                        type="button"
                        onClick={() => togglePhase(phase.value)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filters.phases.includes(phase.value)
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {phase.label}
                    </button>
                ))}
            </div>
        </div>
    )
}