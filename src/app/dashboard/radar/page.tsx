'use client'

import { useState } from 'react'
import { RadarKPIs } from './_components/RadarKPIs'
import { RadarFilters } from './_components/RadarFilters'
import { RadarTable } from './_components/RadarTable'

interface FiltersState {
    zipcodes: string
    propertyTypes: string
    phases: string[]
    minScore: string
    maxScore: string
}

export default function RadarPage() {
    const [filters, setFilters] = useState<FiltersState>({
        zipcodes: '',
        propertyTypes: '',
        phases: [],
        minScore: '',
        maxScore: '',
    })

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Radar MandatFinder</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Détection d'opportunités immobilières — scoring des vendeurs
                    </p>
                </div>
            </div>

            <RadarKPIs />

            <RadarFilters onFiltersChange={setFilters} />

            <RadarTable filters={filters} />
        </div>
    )
}