import type { Metadata } from 'next'
import { PropertiesTable } from './PropertiesTable'
import { PropertiesMapWrapper } from './PropertiesMapWrapper'

export const metadata: Metadata = {
  title: 'Biens du marché — Mandat OS',
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ zipcode?: string }>
}) {
  const { zipcode } = await searchParams

  return (
    <PropertiesTable
      initialZipcode={zipcode}
      mapWrapper={<PropertiesMapWrapper initialZipcode={zipcode} />}
    />
  )
}
