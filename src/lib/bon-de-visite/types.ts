export type IdentityDocType = 'cni' | 'passeport' | 'permis' | 'titre_sejour' | 'autre'

export const IDENTITY_DOC_LABELS: Record<IdentityDocType, string> = {
  cni: "Carte Nationale d'Identité (CNI)",
  passeport: 'Passeport',
  permis: 'Permis de conduire',
  titre_sejour: 'Titre de séjour',
  autre: "Autre pièce d'identité",
}

export type VisitorInfo = {
  first_name: string
  last_name: string
  id_type?: IdentityDocType
  cni_number: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export type EmailDeliveryStatus = 'pending' | 'sent' | 'partial' | 'failed'

export type BonDeVisite = {
  id: string
  reference: string
  token: string
  project_id: string | null

  // Bien visité
  property_address: string
  property_city: string
  property_zipcode: string | null
  property_type: string | null
  property_price: number | null
  mandate_ref: string | null

  // Visite & Visiteurs
  visit_at: string
  visitors_count: number
  visitors: VisitorInfo[]

  // Engagements légaux & Signature
  legal_text: string
  signature_data_url: string
  signer_name: string

  // Conseiller mandataire
  advisor_name: string
  advisor_email: string
  advisor_phone: string
  advisor_rsac: string

  // Email status
  email_status: EmailDeliveryStatus
  email_sent_at: string | null

  // Notes
  notes: string | null

  created_at: string
  updated_at: string
}

export type CreateBonDeVisiteInput = {
  project_id?: string | null
  property_address: string
  property_city: string
  property_zipcode?: string | null
  property_type?: string | null
  property_price?: number | null
  mandate_ref?: string | null
  visit_at?: string
  visitors: VisitorInfo[]
  signature_data_url: string
  signer_name?: string
  notes?: string | null
}
