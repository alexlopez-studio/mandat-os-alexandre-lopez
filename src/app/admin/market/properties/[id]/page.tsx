import type { Metadata } from 'next'
import { PropertyDetail } from './PropertyDetail'

export const metadata: Metadata = {
  title: 'Détail bien — Mandat OS',
}

export default function PropertyDetailPage() {
  return <PropertyDetail />
}