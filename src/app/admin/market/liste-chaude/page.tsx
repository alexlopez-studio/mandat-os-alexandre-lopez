import type { Metadata } from 'next'
import { WarmListClient } from './WarmListClient'

export const metadata: Metadata = {
  title: 'Réseau — Mandat OS',
}

export default function ListeChaudePage() {
  return <WarmListClient />
}
