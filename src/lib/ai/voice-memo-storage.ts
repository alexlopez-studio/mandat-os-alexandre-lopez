import { supabaseAdmin } from '@/lib/supabase'

/** Bucket prive : les enregistrements de rendez-vous sont des donnees clients. */
export const VOICE_MEMO_BUCKET = 'voice-memos'

/**
 * Duree de vie d'un lien d'ecoute, alignee sur les autres documents clients
 * (`client-portal.ts`, `market/client-admin.ts`).
 */
export const VOICE_MEMO_URL_TTL_SECONDS = 60 * 15

/**
 * Lien signe et temporaire vers un fichier du bucket.
 *
 * Le bucket etant prive, aucune URL durable n'est stockee en base : on ne
 * conserve que le chemin, et l'URL est signee a chaque lecture. Une URL
 * publique enregistree en base resterait valable indefiniment pour quiconque
 * la recupere.
 */
export async function signVoiceMemoUrl(storagePath: string | null | undefined): Promise<string | null> {
  if (!storagePath) return null

  const { data, error } = await supabaseAdmin.storage
    .from(VOICE_MEMO_BUCKET)
    .createSignedUrl(storagePath, VOICE_MEMO_URL_TTL_SECONDS)

  if (error) {
    console.warn('[signVoiceMemoUrl] signature impossible:', storagePath, error.message)
    return null
  }

  return data?.signedUrl ?? null
}

type SignablePhoto = { storage_path?: string | null; url?: string | null }

/** Signe les photos d'une note, en preservant leurs autres champs. */
export async function signVoiceMemoPhotos<T extends SignablePhoto>(photos: T[] | null | undefined): Promise<T[]> {
  if (!photos?.length) return []

  return Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      url: (await signVoiceMemoUrl(photo.storage_path)) ?? undefined,
    }))
  )
}
