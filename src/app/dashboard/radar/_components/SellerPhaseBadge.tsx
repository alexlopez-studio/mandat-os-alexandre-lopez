'use client'

import type { SellerPhase } from '@/lib/mandat/types'

const phaseConfig: Record<SellerPhase, { label: string; color: string; bg: string }> = {
    cold: {
        label: 'Froid',
        color: 'text-gray-600',
        bg: 'bg-gray-100',
    },
    warm: {
        label: 'Tiède',
        color: 'text-yellow-700',
        bg: 'bg-yellow-100',
    },
    hot: {
        label: 'Chaud',
        color: 'text-orange-700',
        bg: 'bg-orange-100',
    },
    golden: {
        label: 'Fenêtre d\'or',
        color: 'text-red-700',
        bg: 'bg-red-100',
    },
}

export function SellerPhaseBadge({ phase }: { phase: SellerPhase }) {
    const config = phaseConfig[phase] ?? phaseConfig.cold

    return (
        <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bg}`}
        >
            {config.label}
        </span>
    )
}