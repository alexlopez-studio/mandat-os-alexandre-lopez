import type { Metadata } from 'next'
import { PropertiesTable } from './PropertiesTable'
import { PropertiesMapWrapper } from './PropertiesMapWrapper'

export const metadata: Metadata = {
  title: 'Marché — Mandat OS',
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ zipcode?: string }>
}) {
  const { zipcode } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <PropertiesMapWrapper initialZipcode={zipcode} />
      <PropertiesTable initialZipcode={zipcode} />
    </div>
  )
}
