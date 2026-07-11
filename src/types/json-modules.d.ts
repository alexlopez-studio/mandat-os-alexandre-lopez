declare module '@/data/communes.json' {
  const communes: Array<{
    slug: string
    name: string
    postalCode: string
    department: string
    region: string
    lat: number
    lng: number
    description: string
  }>
  export default communes
}