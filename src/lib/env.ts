export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  resend: { apiKey: process.env.RESEND_API_KEY },
  attio: { apiKey: process.env.ATTIO_API_KEY },
  admin: { password: process.env.ADMIN_PASSWORD ?? '' },
  streamEstate: {
    apiUrl: process.env.STREAMESTATE_API_URL ?? 'https://api.stream.estate',
    apiKey: process.env.STREAMESTATE_API_KEY ?? '',
  },
  app: {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alexlopez-provence.fr',
    calcomUrl: process.env.NEXT_PUBLIC_CALCOM_URL ?? 'https://cal.com/alex-lopez/consultation-gratuite',
    iadListingsUrl: process.env.NEXT_PUBLIC_IAD_LISTINGS_URL ?? '',
    iadEstimationUrl: 'https://www.iadfrance.fr/conseiller-immobilier/alexandre.lopez/estimation',
  },
} as const

export const ESTIMATION_URL = env.app.iadEstimationUrl

/**
 * Résolution d'URL pour les outils interactifs (estimation / projet d'achat / audit).
 *
 * Historiquement, ces outils vivaient sur l'app SaaS (app.alexlopez-provence.fr) et
 * cette fonction construisait une URL absolue vers cette app via NEXT_PUBLIC_APP_URL.
 *
 * Désormais, tous les outils sont intégrés directement au site (route /outils + /vendre /acheter /audit).
 * On retourne donc le path relatif tel quel, et '/outils' (le hub) pour un appel sans path.
 * Les appelants existants comme `appUrl(href) || href` ou `appUrl('') || '/assistant'`
 * continuent de fonctionner et pointent maintenant vers le site lui-même.
 */
export function appUrl(path: string = ''): string {
  return path || '/outils'
}

/**
 * URL publique des biens Alex Lopez sur IAD (ou '' si non configurée).
 */
export function biensUrl(): string {
  return env.app.iadListingsUrl || ''
}
